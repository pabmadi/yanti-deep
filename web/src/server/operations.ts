/**
 * Comandos de operación FL-02/FL-03 (doc 02): crear borrador, enviar, aceptar,
 * iniciar pago, acreditar por webhook/consulta reconciliada, cancelar.
 * Toda transición valida: permisos, estado SM-OPS, retenciones e idempotencia.
 */
import type { DatabaseSync } from "node:sqlite";
import { id, nowIso, supportCode, sha256 } from "@/data/ids";
import { getAccount } from "@/data/repos/account-repo";
import {
  getOperation,
  updateOperationState,
  assertNotHeld,
  getPartyRole,
  listOperationsForAccount,
} from "@/data/repos/operation-repo";
import {
  createPaymentAttempt,
  getAttemptByRef,
  getLatestAttempt,
  updateAttemptState,
  hasAccreditedAttempt,
} from "@/data/repos/payment-repo";
import { getFrozenPolicy, quoteBreakdown, validateAmountRange, freezePolicy } from "@/server/policy";
import { errValidation, errAuth, errIdempotencyReused, errVersion } from "@/domain/errors";
import { assertTransitionOps } from "@/domain/state-machines";
import { recordAudit, enqueueOutbox, pushOperationEvent, createNotification, sendEmail } from "@/data/infra";
import { getActiveHolds, addHold } from "@/data/repos/operation-repo";
import { postJournalEntry } from "@/data/repos/ledger-repo";
import { getSettingNumber } from "@/data/repos/setting-repo";

/* Valores por defecto de plazos (política local de prueba; los administrables
 * se leen de admin_setting con este fallback. Nunca productivos). */
const DEFAULT_DELIVERY_DAYS = 10;
const DEFAULT_REQUEST_EXPIRY_DAYS = 7;

/* ------------------------------------------------------------------ */
/* Idempotencia de comandos                                            */
/* ------------------------------------------------------------------ */
export function withIdempotency<T>(
  db: DatabaseSync,
  key: string,
  scope: string,
  fn: () => T,
  expiresMs = 24 * 60 * 60 * 1000,
): T {
  const scopeKey = `${scope}:${key}`;
  const existing = db.prepare("SELECT * FROM idempotency_record WHERE scope_key=?").get(scopeKey) as
    | { request_hash: string; status_code: number; response_json: string }
    | undefined;
  if (existing) {
    if (existing.status_code === 200) {
      return JSON.parse(existing.response_json) as T;
    }
    throw errIdempotencyReused();
  }
  const result = fn();
  db.prepare(
    `INSERT INTO idempotency_record (scope_key, request_hash, status_code, response_json, expires_at)
     VALUES (?, ?, 200, ?, ?)`,
  ).run(scopeKey, sha256(JSON.stringify({ scope })), JSON.stringify(result), new Date(Date.now() + expiresMs).toISOString());
  return result;
}

/* ------------------------------------------------------------------ */
/* Crear solicitud (borrador)                                          */
/* ------------------------------------------------------------------ */
export interface CreateOperationInput {
  sellerId: string;
  title: string;
  description: string;
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  categoryCode: string;
  buyerEmail?: string;
  externalLink?: string;
  expectedDeliveryDays?: number;
}

export function createOperationDraft(db: DatabaseSync, input: CreateOperationInput): string {
  const seller = getAccount(db, input.sellerId);
  if (!seller || seller.status !== "ACTIVE") throw errAuth();
  validateAmountRange(db, input.currency, input.baseAmountMinor);
  if (!input.title.trim() || !input.description.trim()) throw errValidation("Título y descripción son obligatorios");
  if (input.buyerEmail && input.buyerEmail.toLowerCase() === seller.email_canonical) {
    throw errValidation("El comprador no puede ser la misma cuenta");
  }
  if (input.buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.buyerEmail)) {
    throw errValidation("Correo del comprador inválido");
  }

  // Validar elegibilidad: política activa para la combinación.
  quoteBreakdown(db, { countryCode: input.countryCode, currency: input.currency, categoryCode: input.categoryCode }, input.baseAmountMinor);

  const operationId = id("op");
  const now = nowIso();
  const deliveryDays = getSettingNumber(db, "delivery_days", input.expectedDeliveryDays ?? DEFAULT_DELIVERY_DAYS);
  db.prepare(
    `INSERT INTO operation (operation_id, support_code, title, description, country_code, currency, base_amount_minor, category_code, external_link, state, seller_id, buyer_email, expected_delivery_days, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, 1, ?, ?)`,
  ).run(
    operationId,
    supportCode(),
    input.title,
    input.description,
    input.countryCode,
    input.currency,
    input.baseAmountMinor,
    input.categoryCode,
    input.externalLink ?? null,
    input.sellerId,
    input.buyerEmail?.toLowerCase() ?? null,
    deliveryDays,
    now,
    now,
  );
  db.prepare(
    `INSERT INTO operation_party (operation_id, role, account_id, linked_at) VALUES (?, 'SELLER', ?, ?)`,
  ).run(operationId, input.sellerId, now);

  const breakdown = quoteBreakdown(
    db,
    { countryCode: input.countryCode, currency: input.currency, categoryCode: input.categoryCode },
    input.baseAmountMinor,
  );
  db.prepare(
    `INSERT INTO agreement_version (agreement_id, operation_id, version, title, description, country_code, currency, base_amount_minor, category_code, external_link, seller_fee_minor, buyer_fee_minor, buyer_total_minor, seller_net_minor, seller_id, created_by, created_at)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id("agr"),
    operationId,
    input.title,
    input.description,
    input.countryCode,
    input.currency,
    input.baseAmountMinor,
    input.categoryCode,
    input.externalLink ?? null,
    breakdown.sellerFeeMinor,
    breakdown.buyerFeeMinor,
    breakdown.buyerTotalMinor,
    breakdown.sellerNetMinor,
    input.sellerId,
    input.sellerId,
    now,
  );

  recordAudit(db, { actorId: input.sellerId, action: "operation.draft", resourceType: "operation", resourceId: operationId });
  return operationId;
}

/** Congela la política al enviar (hito configurable; en el MVP local se congela al enviar). */
export function sendOperation(db: DatabaseSync, operationId: string, sellerId: string, idemKey?: string): { ok: true } {
  const run = () => {
    const op = getOperation(db, operationId);
    if (!op) throw errAuth();
    if (op.seller_id !== sellerId) throw errAuth();
    if (op.state !== "DRAFT") throw errValidation(`Solicitud en estado ${op.state}; no se puede enviar`);
    if (!op.buyer_email) throw errValidation("Indica el correo del comprador antes de enviar");

    freezePolicy(db, operationId, {
      countryCode: op.country_code,
      currency: op.currency,
      categoryCode: op.category_code,
    });
    // Vencimiento de solicitud (configurable vía admin_setting; fallback local)
    const requestExpiryDays = getSettingNumber(db, "request_expiry_days", DEFAULT_REQUEST_EXPIRY_DAYS);
    const expiresAt = new Date(Date.now() + requestExpiryDays * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE operation SET expires_at=?, version=version+1, updated_at=? WHERE operation_id=?").run(expiresAt, nowIso(), operationId);
    updateOperationState(db, operationId, "AWAITING_ACCEPTANCE", { reason: "Solicitud enviada" });

    pushOperationEvent(db, { operationId, actorId: sellerId, eventType: "operation.sent", label: "Solicitud enviada al comprador", stateFrom: "DRAFT", stateTo: "AWAITING_ACCEPTANCE" });
    enqueueOutbox(db, { aggregateType: "operation", aggregateId: operationId, eventType: "operation.sent", payload: { operationId, buyerEmail: op.buyer_email } });
    recordAudit(db, { actorId: sellerId, action: "operation.send", resourceType: "operation", resourceId: operationId });
    return { ok: true as const };
  };
  return idemKey ? withIdempotency(db, idemKey, `send:${operationId}`, run) : run();
}

/** El comprador (invitado) acepta el acuerdo. Fija buyer en operation_party. */
export function acceptOperation(db: DatabaseSync, operationId: string, buyerAccountId: string, idemKey?: string): { ok: true } {
  const run = () => {
    const op = getOperation(db, operationId);
    if (!op) throw errAuth();
    if (op.buyer_email?.toLowerCase() !== getAccount(db, buyerAccountId)?.email_canonical) {
      throw errAuth();
    }
    if (!["AWAITING_ACCEPTANCE", "ACCEPTED_AWAITING_PAYMENT"].includes(op.state)) {
      throw errValidation(`La solicitud está en estado ${op.state}`);
    }
    db.prepare(
      `INSERT INTO operation_party (operation_id, role, account_id, linked_at) VALUES (?, 'BUYER', ?, ?)`,
    ).run(operationId, buyerAccountId, nowIso());
    db.prepare("UPDATE operation SET buyer_id=?, version=version+1, updated_at=? WHERE operation_id=?").run(
      buyerAccountId,
      nowIso(),
      operationId,
    );
    // Sellar el acuerdo (inmutable)
    db.prepare("UPDATE agreement_version SET buyer_id=?, sealed_at=? WHERE operation_id=? AND version=1").run(buyerAccountId, nowIso(), operationId);
    if (op.state === "AWAITING_ACCEPTANCE") {
      updateOperationState(db, operationId, "ACCEPTED_AWAITING_PAYMENT", { reason: "Acuerdo aceptado por el comprador" });
    }
    pushOperationEvent(db, { operationId, actorId: buyerAccountId, eventType: "operation.accepted", label: "Acuerdo aceptado", stateFrom: op.state, stateTo: "ACCEPTED_AWAITING_PAYMENT" });
    recordAudit(db, { actorId: buyerAccountId, action: "operation.accept", resourceType: "operation", resourceId: operationId });
    return { ok: true as const };
  };
  return idemKey ? withIdempotency(db, idemKey, `accept:${operationId}`, run) : run();
}

export function cancelOperation(db: DatabaseSync, operationId: string, actorId: string, reason?: string): { ok: true } {
  const op = getOperation(db, operationId);
  if (!op) throw errAuth();
  if (op.seller_id !== actorId) throw errAuth();
  if (!["AWAITING_ACCEPTANCE", "DRAFT"].includes(op.state)) {
    throw errValidation(`No se puede cancelar en estado ${op.state}`);
  }
  updateOperationState(db, operationId, "CANCELLED", { reason: reason ?? "Cancelada por el vendedor" });
  pushOperationEvent(db, { operationId, actorId, eventType: "operation.cancelled", label: "Solicitud cancelada", stateFrom: op.state, stateTo: "CANCELLED" });
  recordAudit(db, { actorId, action: "operation.cancel", resourceType: "operation", resourceId: operationId, reason });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Pago simulado (FL-03)                                               */
/* ------------------------------------------------------------------ */

/** Crea el intento de pago y devuelve la URL fake para "ir a pagar". */
export function startPayment(
  db: DatabaseSync,
  operationId: string,
  buyerAccountId: string,
  idemKey: string,
): { attemptId: string; redirectUrl: string } {
  const run = () => {
    const op = getOperation(db, operationId);
    if (!op) throw errAuth();
    const role = getPartyRole(db, operationId, buyerAccountId);
    if (role !== "BUYER") throw errAuth();
    if (op.state !== "ACCEPTED_AWAITING_PAYMENT") {
      throw errValidation(`No se puede pagar en estado ${op.state}`);
    }
    if (hasAccreditedAttempt(db, operationId)) throw errValidation("Ya existe un pago acreditado");
    assertNotHeld(db, operationId, "CERRAR"); // bloquea si hay retención relevante

    // Monto a cobrar = buyer_total del acuerdo sellado.
    const agreement = db
      .prepare("SELECT buyer_total_minor, currency FROM agreement_version WHERE operation_id=? AND version=1")
      .get(operationId) as { buyer_total_minor: number; currency: string } | undefined;
    if (!agreement) throw errValidation("No hay acuerdo sellado");

    const attempt = createPaymentAttempt(db, {
      attemptId: id("pay"),
      operationId,
      requestedTotalMinor: agreement.buyer_total_minor,
      currency: agreement.currency,
      idempotencyKey: `pay:${operationId}:${idemKey}`,
      createdBy: buyerAccountId,
    });

    // El intento pasa a PENDING_USER_PROVIDER y la operación a PAYMENT_IN_PROGRESS.
    updateAttemptState(db, attempt.attempt_id, "PENDING_USER_PROVIDER");
    updateOperationState(db, operationId, "PAYMENT_IN_PROGRESS", { reason: "Pago iniciado" });

    pushOperationEvent(db, { operationId, actorId: buyerAccountId, eventType: "payment.started", label: "Pago iniciado", stateFrom: "ACCEPTED_AWAITING_PAYMENT", stateTo: "PAYMENT_IN_PROGRESS", metadata: { attemptId: attempt.attempt_id } });
    recordAudit(db, { actorId: buyerAccountId, action: "payment.start", resourceType: "operation", resourceId: operationId });

    // URL fake de "checkout" que el navegador visita y retorna (informativo, nunca acredita).
    const redirectUrl = `/pagar/fake?attempt=${attempt.attempt_id}`;
    return { attemptId: attempt.attempt_id, redirectUrl };
  };
  return withIdempotency(db, idemKey, `pay:${operationId}`, run);
}

/**
 * "Webhook" simulado del proveedor o consulta autoritativa. Aquí el fake de pagos
 * notifica acreditación. La transición PENDING->ACCREDITED_PENDING_RECONCILIATION.
 */
export function receiveProviderAccreditation(
  db: DatabaseSync,
  attemptId: string,
  opts: { observedTotalMinor: number; currency: string; externalAccount: string; providerRef: string },
): { ok: true; attemptState: string } {
  const attempt = getAttemptByRef(db, opts.providerRef) ?? db.prepare("SELECT * FROM payment_attempt WHERE attempt_id=?").get(attemptId) as never;
  if (!attempt) throw errValidation("Intento no encontrado");
  const cur = getLatestAttempt(db, attempt.operation_id)!;
  if (cur.attempt_id !== attemptId) throw errValidation("Intento no vigente");

  // Solo PENDING_USER_PROVIDER puede acreditarse; idempotente si ya está acreditado
  // o en camino de acreditación (webhook duplicado, CA-PAG-002).
  if (cur.state === "ACCREDITED" || cur.state === "ACCREDITED_PENDING_RECONCILIATION") {
    return { ok: true, attemptState: cur.state };
  }
  if (cur.state !== "PENDING_USER_PROVIDER") {
    throw errValidation(`Intento en estado ${cur.state}; no puede acreditarse`);
  }

  // Reconciliación: el monto observado DEBE coincidir con lo solicitado (RF-PAG, CA-PAG-003).
  const op = getOperation(db, attempt.operation_id)!;
  const expected = cur.requested_total_minor;
  const observed = opts.observedTotalMinor;
  if (observed !== expected || opts.currency !== op.currency) {
    updateAttemptState(db, attemptId, "INCONSISTENT", { observedTotalMinor: observed, observedCurrency: opts.currency, externalAccount: opts.externalAccount });
    addHold(db, op.operation_id, "PAGO_INCONSISTENTE", "reconciliation", attemptId);
    recordAudit(db, { actorId: "system", action: "payment.inconsistent", resourceType: "operation", resourceId: op.operation_id, reason: `monto ${observed} != esperado ${expected}` });
    throw errValidation("El pago no concuerda con lo solicitado; se requiere revisión");
  }

  updateAttemptState(db, attemptId, "ACCREDITED_PENDING_RECONCILIATION", { observedTotalMinor: observed, observedCurrency: opts.currency, externalAccount: opts.externalAccount });
  return { ok: true, attemptState: "ACCREDITED_PENDING_RECONCILIATION" };
}

/** Reconciliación final (admin o worker): ACREDITED_PENDING_RECONCILIATION -> ACREDITED y operación PAGADA. */
export function reconcileAndAccredit(db: DatabaseSync, operationId: string, actorId: string, opts: { at?: string } = {}): { ok: true } {
  const op = getOperation(db, operationId);
  if (!op) throw errAuth();
  const attempt = getLatestAttempt(db, operationId);
  if (!attempt) throw errValidation("No hay intento de pago");
  if (attempt.state === "ACCREDITED") return { ok: true }; // idempotente
  if (attempt.state !== "ACCREDITED_PENDING_RECONCILIATION") {
    throw errValidation(`Intento en estado ${attempt.state}`);
  }

  // Asiento de cobro (cargo acreditado): el dinero entra al libro interno.
  const agreement = db
    .prepare(
      "SELECT base_amount_minor, buyer_fee_minor, buyer_total_minor, seller_fee_minor, currency FROM agreement_version WHERE operation_id=? AND version=1",
    )
    .get(operationId) as {
    base_amount_minor: number;
    buyer_fee_minor: number;
    buyer_total_minor: number;
    seller_fee_minor: number;
    currency: string;
  } | undefined;
  if (!agreement) throw errValidation("Sin acuerdo sellado");
  postJournalEntry(db, {
    operationId,
    entryType: "CHARGE",
    currency: agreement.currency,
    cause: "payment.accredited",
    causeRef: attempt.attempt_id,
    author: actorId,
    postings: [
      { logicalAccount: "PROVIDER_CLEARING", side: "DEBIT", amountMinor: agreement.buyer_total_minor, currency: agreement.currency, component: "PRINCIPAL" },
      { logicalAccount: "PROTECTED_PRINCIPAL", side: "CREDIT", amountMinor: agreement.base_amount_minor, currency: agreement.currency, component: "PRINCIPAL" },
      { logicalAccount: "BUYER_FEE_REVENUE", side: "CREDIT", amountMinor: agreement.buyer_fee_minor, currency: agreement.currency, component: "BUYER_FEE" },
    ],
  }, { at: opts.at });

  updateAttemptState(db, attempt.attempt_id, "ACCREDITED");
  updateOperationState(db, operationId, "PAID_AWAITING_SHIPMENT", { reason: "Pago acreditado y conciliado" });
  pushOperationEvent(db, { operationId, actorId, eventType: "payment.accredited", label: "Pago acreditado", stateFrom: "PAYMENT_IN_PROGRESS", stateTo: "PAID_AWAITING_SHIPMENT" });
  enqueueOutbox(db, { aggregateType: "operation", aggregateId: operationId, eventType: "payment.accredited", payload: { operationId } });
  recordAudit(db, { actorId, action: "payment.reconcile", resourceType: "operation", resourceId: operationId });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Consultas auxiliares de operación                                   */
/* ------------------------------------------------------------------ */
export function listMyOperations(db: DatabaseSync, accountId: string) {
  return listOperationsForAccount(db, accountId);
}
