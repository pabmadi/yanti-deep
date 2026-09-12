/**
 * Disputas FL-06..08 + consola de operaciones (doc 02). Reclamo crea retención
 * DISPUTA_ABIERTA atómicamente; evidencia bilateral; resolución admin con doble
 * aprobación sobre umbral; devolución básica.
 */
import type { DatabaseSync } from "node:sqlite";
import { id, nowIso } from "@/data/ids";
import {
  getOperation,
  getPartyRole,
  addHold,
  releaseHold,
  updateOperationState,
} from "@/data/repos/operation-repo";
import {
  createDispute,
  getDisputeByOperation,
  getOpenDispute,
  addSubmission,
  listSubmissions,
  createResolution,
  updateResolutionState,
  getResolution,
  updateDisputeState,
  DISPUTE_STATES_OPEN,
  type DisputeRow,
  type ResolutionRow,
} from "@/data/repos/dispute-repo";
import { executeRelease, executeRefund } from "./shipping";
import { postJournalEntry, attributableBalance } from "@/data/repos/ledger-repo";
import { asRows } from "@/data/db";
import { errAuth, errValidation } from "@/domain/errors";
import { assertTransitionOps, type DisputeReason, type ResolutionOutcome } from "@/domain/state-machines";
import { recordAudit, pushOperationEvent, enqueueOutbox, createNotification } from "@/data/infra";
import { getSettingNumber } from "@/data/repos/setting-repo";

/** Umbral por defecto para segunda aprobación (valor de prueba local; administrable). */
const DEFAULT_SECOND_APPROVAL_THRESHOLD_MINOR = 5_000_000; // p.ej. $50.000 ARS

/* ------------------------------------------------------------------ */
/* Abrir reclamo (solo comprador, antes de liberación irreversible)    */
/* ------------------------------------------------------------------ */
export function openDispute(
  db: DatabaseSync,
  operationId: string,
  buyerId: string,
  input: { reason: DisputeReason; description: string },
): { disputeId: string } {
  const op = getOperation(db, operationId);
  if (!op) throw errAuth();
  const role = getPartyRole(db, operationId, buyerId);
  if (role !== "BUYER") throw errAuth();
  const postClosure = ["COMPLETED", "REFUNDED"].includes(op.state);
  if (!["PAID_AWAITING_SHIPMENT", "SHIPPED_AWAITING_RECEIPT", "CONFIRMATION_OVERDUE", "COMPLETED", "REFUNDED"].includes(op.state)) {
    throw errValidation(`No se puede reclamar en estado ${op.state}`);
  }
  const open = getOpenDispute(db, operationId);
  if (open) throw errValidation("Ya existe un reclamo abierto para esta operación");
  if (!input.reason || !input.description.trim()) throw errValidation("Indica el motivo y describe el problema");

  // Transacción: disputa + retención + transición de operación, todo atómico.
  db.exec("BEGIN");
  try {
    const disputeId = id("dsp");
    createDispute(db, { disputeId, operationId, openedBy: buyerId, reason: input.reason, description: input.description });
    if (!postClosure) {
      addHold(db, operationId, "DISPUTA_ABIERTA", "dispute", disputeId);
      updateOperationState(db, operationId, "IN_DISPUTE", { reason: `Reclamo abierto: ${input.reason}` });
    }
    pushOperationEvent(db, { operationId, actorId: buyerId, eventType: "dispute.opened", label: "Reclamo abierto", stateFrom: op.state, stateTo: postClosure ? op.state : "IN_DISPUTE", metadata: { disputeId, reason: input.reason, postClosure } });
    recordAudit(db, { actorId: buyerId, action: "dispute.open", resourceType: "operation", resourceId: operationId, reason: input.reason });
    db.exec("COMMIT");
    return { disputeId };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Aportar evidencia/alegación a la disputa (ambas partes; visibilidad PARTIES). */
export function submitDisputeEvidence(
  db: DatabaseSync,
  disputeId: string,
  authorId: string,
  body: string,
): { submissionId: string } {
  const dispute = getDisputeByOperationForAuthor(db, disputeId, authorId);
  if (!dispute) throw errAuth();
  if (DISPUTE_STATES_OPEN.includes(dispute.state) === false) throw errValidation("La disputa ya está resuelta");
  if (!body.trim()) throw errValidation("Escribe tu alegación");
  const sub = addSubmission(db, { disputeId, authorId, body, visibility: "PARTIES" });
  createNotification(db, { accountId: dispute.opened_by === authorId ? otherParty(db, dispute.operation_id, authorId) : dispute.opened_by, operationId: dispute.operation_id, eventType: "dispute.evidence", body: "Nueva evidencia en tu reclamo", actionRequired: true });
  recordAudit(db, { actorId: authorId, action: "dispute.submission", resourceType: "dispute", resourceId: disputeId });
  return { submissionId: sub.submission_id };
}

function getDisputeByOperationForAuthor(db: DatabaseSync, disputeId: string, authorId: string): DisputeRow | undefined {
  const dispute = db.prepare("SELECT * FROM dispute WHERE dispute_id=?").get(disputeId) as DisputeRow | undefined;
  if (!dispute) return undefined;
  const role = getPartyRole(db, dispute.operation_id, authorId);
  return role ? dispute : undefined;
}

function otherParty(db: DatabaseSync, operationId: string, accountId: string): string {
  const op = getOperation(db, operationId)!;
  return op.seller_id === accountId ? op.buyer_id! : op.seller_id;
}

/* ------------------------------------------------------------------ */
/* Resolución administrativa                                           */
/* ------------------------------------------------------------------ */
export function proposeResolution(
  db: DatabaseSync,
  operationId: string,
  adminId: string,
  input: {
    outcome: ResolutionOutcome;
    rationale: string;
    principalTo?: "SELLER" | "BUYER";
    refundRequired?: boolean;
    returnDeadlineDays?: number;
  },
): { resolutionId: string } {
  const op = getOperation(db, operationId);
  const admin = requireAdmin(db, adminId);
  if (!op) throw errAuth();
  const dispute = getDisputeByOperation(db, operationId);
  if (!dispute || !DISPUTE_STATES_OPEN.includes(dispute.state)) throw errValidation("No hay disputa abierta");
  if (!input.rationale.trim()) throw errValidation("La resolución debe estar fundada (motivo estructurado)");

  // Si la disputa ya tiene una resolución pendiente, no crear otra (idempotencia de UI).
  if (dispute.resolution_id) {
    const existing = getResolution(db, dispute.resolution_id);
    if (existing && (existing.state === "PROPOSED" || existing.state === "PENDING_SECOND_APPROVAL")) {
      return { resolutionId: existing.resolution_id };
    }
  }

  const principalTo = input.principalTo ?? (input.outcome === "RELEASE_TO_SELLER" ? "SELLER" : "BUYER");
  const refundRequired = input.refundRequired ?? input.outcome === "REQUIRE_RETURN";
  const resolutionId = id("res");
  createResolution(db, {
    resolutionId,
    disputeId: dispute.dispute_id,
    outcome: input.outcome,
    rationale: input.rationale,
    principalTo,
    buyerFeeTo: principalTo === "SELLER" ? "BUYER" : "BUYER",
    sellerFeeTo: principalTo === "SELLER" ? "SELLER" : "SELLER",
    refundRequired,
    returnDeadlineDays: input.returnDeadlineDays,
    authorId: adminId,
  });
  // Vincular la resolución a la disputa (para que la UI la muestre y no se duplique).
  db.prepare("UPDATE dispute SET resolution_id=? WHERE dispute_id=?").run(resolutionId, dispute.dispute_id);

  // Si supera umbral (administrable vía admin_setting), requiere segunda aprobación.
  const agreement = db.prepare("SELECT base_amount_minor FROM agreement_version WHERE operation_id=? AND version=1").get(operationId) as { base_amount_minor: number } | undefined;
  const amount = agreement?.base_amount_minor ?? 0;
  const threshold = getSettingNumber(db, "dispute_second_approval_threshold_minor", DEFAULT_SECOND_APPROVAL_THRESHOLD_MINOR);
  if (amount >= threshold) {
    updateResolutionState(db, resolutionId, "PENDING_SECOND_APPROVAL");
    updateDisputeState(db, dispute.dispute_id, "PENDING_SECOND_APPROVAL");
  } else {
    updateDisputeState(db, dispute.dispute_id, "PROPOSED_RESOLUTION");
  }
  recordAudit(db, { actorId: adminId, action: "dispute.proposeResolution", resourceType: "dispute", resourceId: dispute.dispute_id, reason: input.rationale });
  return { resolutionId };
}

function requireAdmin(db: DatabaseSync, accountId: string): void {
  const acc = db.prepare("SELECT * FROM account WHERE account_id=?").get(accountId) as { is_admin: number } | undefined;
  if (!acc || !acc.is_admin) throw errAuth();
}

export function confirmResolution(
  db: DatabaseSync,
  operationId: string,
  adminId: string,
  resolutionId: string,
): { ok: true } {
  const op = getOperation(db, operationId);
  const admin = requireAdmin(db, adminId);
  if (!op) throw errAuth();
  const resolution = getResolution(db, resolutionId);
  if (!resolution) throw errValidation("Resolución no encontrada");
  const dispute = getDisputeByOperation(db, operationId);
  if (!dispute) throw errValidation("Sin disputa");
  if (dispute.state === "PENDING_SECOND_APPROVAL") {
    if (dispute.reviewer_id === adminId) throw errValidation("Requiere un segundo administrador distinto");
  }
  if (resolution.author_id === adminId && resolution.state === "PENDING_SECOND_APPROVAL") {
    throw errValidation("El autor no puede aprobar su propia resolución en doble control");
  }

  updateResolutionState(db, resolutionId, "CONFIRMED", adminId);
  updateDisputeState(db, dispute.dispute_id, resolutionOutcomeToDisputeState(resolution.outcome));

  // Ejecutar el movimiento según el fallo.
  switch (resolution.outcome) {
    case "RELEASE_TO_SELLER":
      releaseHold(db, operationId, "DISPUTA_ABIERTA", adminId, "Resolución: liberar al vendedor");
      executeRelease(db, operationId, "resolution", `Resolución ${resolution.resolution_id}`);
      break;
    case "REFUND_WITHOUT_RETURN": {
      releaseHold(db, operationId, "DISPUTA_ABIERTA", adminId, "Resolución: reembolsar");
      const agreement = db.prepare("SELECT buyer_total_minor FROM agreement_version WHERE operation_id=? AND version=1").get(operationId) as { buyer_total_minor: number };
      executeRefund(db, operationId, "resolution", `Resolución ${resolution.resolution_id}`, agreement.buyer_total_minor);
      break;
    }
    case "REQUIRE_RETURN": {
      updateOperationState(db, operationId, "RETURN_REQUIRED", { reason: "Resolución exige devolución antes del reembolso" });
      const deadlineDays = resolution.return_deadline_days ?? 7;
      const returnId = id("ret");
      db.prepare(
        `INSERT INTO return_case (return_id, resolution_id, operation_id, state, refund_hit_milestone, deadline, created_at)
         VALUES (?, ?, ?, 'INSTRUCTIONS_ISSUED', ?, ?, ?)`,
      ).run(returnId, resolutionId, operationId, "DELIVERED", new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString(), nowIso());
      pushOperationEvent(db, { operationId, actorId: adminId, eventType: "return.required", label: `Devolución requerida (${deadlineDays} días)`, stateFrom: dispute.state, stateTo: "RETURN_REQUIRED" });
      break;
    }
    case "AGREEMENT": {
      // Acuerdo bilateral: ambos aceptaron la misma propuesta (validado antes de llamar).
      releaseHold(db, operationId, "DISPUTA_ABIERTA", adminId, "Acuerdo entre partes");
      executeRefund(db, operationId, "settlement", `Acuerdo verificado ${resolution.resolution_id}`);
      break;
    }
  }
  recordAudit(db, { actorId: adminId, action: "dispute.resolve", resourceType: "dispute", resourceId: dispute.dispute_id, reason: `outcome=${resolution.outcome}` });
  return { ok: true };
}

function resolutionOutcomeToDisputeState(outcome: ResolutionOutcome): DisputeRow["state"] {
  switch (outcome) {
    case "RELEASE_TO_SELLER": return "RESOLVED_RELEASE";
    case "REFUND_WITHOUT_RETURN": return "RESOLVED_REFUND";
    case "REQUIRE_RETURN": return "RESOLVED_RETURN";
    case "AGREEMENT": return "RESOLVED_AGREEMENT";
  }
}

/* ------------------------------------------------------------------ */
/* Devolución (FL-09): registrar despacho y confirmar recepción        */
/* ------------------------------------------------------------------ */
export function registerReturnDispatch(
  db: DatabaseSync,
  returnId: string,
  buyerId: string,
  input: { carrier: string; trackingCode: string },
): { ok: true } {
  const ret = db.prepare("SELECT * FROM return_case WHERE return_id=?").get(returnId) as { return_id: string; operation_id: string; resolution_id: string; state: string; refund_hit_milestone: string } | undefined;
  if (!ret) throw errAuth();
  const role = getPartyRole(db, ret.operation_id, buyerId);
  if (role !== "BUYER") throw errAuth();
  const operation = getOperation(db, ret.operation_id);
  if (operation?.state !== "RETURN_REQUIRED" || ret.state !== "INSTRUCTIONS_ISSUED") {
    throw errValidation("Esta devolución ya fue registrada o dejó de estar pendiente. Revisá su estado actual.");
  }
  const carrier = input.carrier.trim();
  const trackingCode = input.trackingCode.trim();
  if (!carrier || !trackingCode) throw errValidation("Indicá el transportista y el código de seguimiento.");
  db.prepare("UPDATE return_case SET state='DISPATCHED', carrier=?, tracking_code=?, dispatched_at=? WHERE return_id=?").run(
    carrier,
    trackingCode,
    nowIso(),
    returnId,
  );
  recordAudit(db, { actorId: buyerId, action: "return.dispatch", resourceType: "return", resourceId: returnId });
  return { ok: true };
}

/** Hito de reembolso de devolución (admin/operaciones valida recepción). */
export function completeReturnAndRefund(
  db: DatabaseSync,
  returnId: string,
  adminId: string,
): { ok: true } {
  const ret = db.prepare("SELECT * FROM return_case WHERE return_id=?").get(returnId) as { return_id: string; operation_id: string; resolution_id: string; state: string; refund_hit_milestone: string } | undefined;
  if (!ret) throw errAuth();
  requireAdmin(db, adminId);
  if (ret.state !== "DISPATCHED" && ret.state !== "IN_TRANSIT") {
    throw errValidation(`Devolución en estado ${ret.state}; no se puede cerrar`);
  }
  db.prepare("UPDATE return_case SET state='RECIBIDA_CONFORME', received_at=? WHERE return_id=?").run(nowIso(), returnId);
  releaseHold(db, ret.operation_id, "DISPUTA_ABIERTA", adminId, "Devolución recibida conforme");
  const agreement = db.prepare("SELECT buyer_total_minor FROM agreement_version WHERE operation_id=? AND version=1").get(ret.operation_id) as { buyer_total_minor: number };
  executeRefund(db, ret.operation_id, "return", `Devolución recibida ${returnId}`, agreement.buyer_total_minor);
  recordAudit(db, { actorId: adminId, action: "return.complete", resourceType: "return", resourceId: returnId });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Consultas de disputa para bandeja admin                             */
/* ------------------------------------------------------------------ */
export function listOpenDisputes(db: DatabaseSync): Array<{ dispute: DisputeRow; operationId: string; title: string; supportCode: string }> {
  const disputes = asRows<DisputeRow>(
    db
      .prepare(`SELECT * FROM dispute WHERE state IN (${DISPUTE_STATES_OPEN.map(() => "?").join(",")}) ORDER BY opened_at ASC`)
      .all(...DISPUTE_STATES_OPEN),
  );
  return disputes.map((d) => {
    const op = getOperation(db, d.operation_id)!;
    return { dispute: d, operationId: d.operation_id, title: op.title, supportCode: op.support_code };
  });
}
