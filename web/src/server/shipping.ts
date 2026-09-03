/**
 * FL-04/FL-05: declarar envío con evidencia, confirmar recepción, tick de vencimientos
 * y liberación (orden idempotente + ledger). Concurrencia y reevaluación (doc 02 §10).
 */
import type { DatabaseSync } from "node:sqlite";
import { id, nowIso } from "@/data/ids";
import { getOperation, updateOperationState, assertNotHeld, getPartyRole } from "@/data/repos/operation-repo";
import { saveShipmentDraft, declareShipment, getShipment } from "@/data/repos/shipment-repo";
import { getFrozenPolicy } from "@/server/policy";
import { computeFee } from "@/domain/fees";
import {
  createFinancialOrder,
  updateOrderState,
  getOrderByOperationType,
  getOrderByIdempotencyKey,
} from "@/data/repos/financial-order-repo";
import { postJournalEntry, attributableBalance } from "@/data/repos/ledger-repo";
import { errAuth, errValidation, errHeld, errDecisionPending } from "@/domain/errors";
import { assertTransitionOps } from "@/domain/state-machines";
import { recordAudit, pushOperationEvent, enqueueOutbox, createNotification, sendEmail } from "@/data/infra";
import { getAccount } from "@/data/repos/account-repo";

/* ------------------------------------------------------------------ */
/* Declarar envío                                                      */
/* ------------------------------------------------------------------ */
export function submitShipment(
  db: DatabaseSync,
  operationId: string,
  sellerId: string,
  input: {
    carrier: string;
    trackingCode: string;
    trackingUrl?: string;
    dispatchDate?: string;
    estimatedDelivery?: string;
  },
): { ok: true } {
  const op = getOperation(db, operationId);
  if (!op) throw errAuth();
  if (op.seller_id !== sellerId) throw errAuth();
  if (op.state !== "PAID_AWAITING_SHIPMENT") {
    throw errValidation(`El envío solo puede declararse con pago acreditado (estado actual: ${op.state})`);
  }
  assertNotHeld(db, operationId, "INICIAR_ENVIO");
  if (!input.carrier.trim() || !input.trackingCode.trim()) {
    throw errValidation("Transportista y tracking son obligatorios para declarar el envío");
  }
  saveShipmentDraft(db, operationId, {
    carrier: input.carrier,
    trackingCode: input.trackingCode,
    trackingUrl: input.trackingUrl,
    dispatchDate: input.dispatchDate,
    estimatedDelivery: input.estimatedDelivery,
  });
  declareShipment(db, operationId, sellerId);
  updateOperationState(db, operationId, "SHIPPED_AWAITING_RECEIPT", { reason: "Envío declarado" });

  // Fecha límite de confirmación: expected_delivery_days desde hoy (política local).
  const deadline = new Date(Date.now() + (op.expected_delivery_days ?? 10) * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE operation SET updated_at=? WHERE operation_id=?").run(nowIso(), operationId);

  pushOperationEvent(db, { operationId, actorId: sellerId, eventType: "shipment.declared", label: "Producto despachado", stateFrom: "PAID_AWAITING_SHIPMENT", stateTo: "SHIPPED_AWAITING_RECEIPT", metadata: { trackingCode: input.trackingCode } });
  enqueueOutbox(db, { aggregateType: "operation", aggregateId: operationId, eventType: "shipment.declared", payload: { operationId, deadline } });
  if (op.buyer_id) {
    createNotification(db, { accountId: op.buyer_id, operationId, eventType: "shipment.declared", body: `Tu compra fue despachada. Confírmala antes de ${new Date(deadline).toLocaleString()}.`, actionRequired: true, deadline });
    sendEmail(db, { toEmail: getAccount(db, op.buyer_id)!.email_canonical, subject: "Tu compra fue despachada", bodyText: `Tu compra (${op.support_code}) fue despachada. Confirma la recepción antes de ${new Date(deadline).toLocaleString()}.`, bodyHtml: `<p>Tu compra fue despachada. Confirma la recepción antes de ${new Date(deadline).toLocaleString()}.</p>`, purpose: "shipment.declared", operationId });
  }
  recordAudit(db, { actorId: sellerId, action: "shipment.declare", resourceType: "operation", resourceId: operationId });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Confirmar recepción                                                 */
/* ------------------------------------------------------------------ */
export function confirmReceipt(db: DatabaseSync, operationId: string, buyerId: string, idemKey: string): { ok: true } {
  const run = () => {
    const op = getOperation(db, operationId);
    if (!op) throw errAuth();
    const role = getPartyRole(db, operationId, buyerId);
    if (role !== "BUYER") throw errAuth();
    if (!["SHIPPED_AWAITING_RECEIPT", "CONFIRMATION_OVERDUE"].includes(op.state)) {
      throw errValidation(`No se puede confirmar en estado ${op.state}`);
    }
    assertNotHeld(db, operationId, "LIBERAR");
    updateOperationState(db, operationId, "RELEASE_IN_PROGRESS", { reason: "Recepción confirmada por el comprador" });
    pushOperationEvent(db, { operationId, actorId: buyerId, eventType: "receipt.confirmed", label: "Recepción confirmada", stateFrom: op.state, stateTo: "RELEASE_IN_PROGRESS" });
    recordAudit(db, { actorId: buyerId, action: "receipt.confirm", resourceType: "operation", resourceId: operationId });

    // Orden de liberación idempotente + ejecución fake
    executeRelease(db, operationId, "confirm", "recepción confirmada");
    return { ok: true as const };
  };
  return idempotentCommand(db, idemKey, `confirm:${operationId}`, run);
}

function idempotentCommand<T>(db: DatabaseSync, key: string, scope: string, fn: () => T): T {
  // Registro simple de idempotencia para acciones críticas (clave estable)
  const existing = db.prepare("SELECT response_json FROM idempotency_record WHERE scope_key=?").get(`${scope}:${key}`) as
    | { response_json: string }
    | undefined;
  if (existing) return JSON.parse(existing.response_json) as T;
  const result = fn();
  db.prepare(
    "INSERT OR IGNORE INTO idempotency_record (scope_key, request_hash, status_code, response_json, expires_at) VALUES (?, 'cmd', 200, ?, ?)",
  ).run(`${scope}:${key}`, JSON.stringify(result), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  return result;
}

/* ------------------------------------------------------------------ */
/* Orden financiera de liberación (fake, idempotente)                  */
/* ------------------------------------------------------------------ */
export function executeRelease(
  db: DatabaseSync,
  operationId: string,
  cause: string,
  causeLabel: string,
  opts: { at?: string } = {},
): { orderId: string } {
  const op = getOperation(db, operationId);
  if (!op) throw new Error("operation not found");

  // Reevaluar (RF-CON-007): releer estado y retenciones en la transacción.
  assertNotHeld(db, operationId, "LIBERAR");
  if (!["RELEASE_IN_PROGRESS", "IN_DISPUTE", "RETURN_REQUIRED", "SHIPPED_AWAITING_RECEIPT", "CONFIRMATION_OVERDUE", "PAID_AWAITING_SHIPMENT"].includes(op.state)) {
    throw errValidation(`No elegible para liberar en estado ${op.state}`);
  }
  const agreement = db
    .prepare(
      "SELECT seller_net_minor, currency, buyer_total_minor, base_amount_minor, seller_fee_minor FROM agreement_version WHERE operation_id=? AND version=1",
    )
    .get(operationId) as {
    seller_net_minor: number;
    currency: string;
    buyer_total_minor: number;
    base_amount_minor: number;
    seller_fee_minor: number;
  } | undefined;
  if (!agreement) throw errValidation("Sin acuerdo sellado");

  // Clave de idempotencia estable: una sola liberación por causa (doc 06 §18).
  const key = `operation:${operationId}:release:${cause}`;
  const existing = getOrderByIdempotencyKey(db, key);
  if (existing) {
    if (existing.state === "CONFIRMED") return { orderId: existing.order_id };
    throw errHeld(["ORDEN_FINANCIERA_INCIERTA"]);
  }

  const balance = attributableBalance(db, operationId);
  const amountMinor = agreement.base_amount_minor; // liberar el principal; el fee del vendedor se reconoce
  const sellerNet = agreement.seller_net_minor;
  const sellerFee = agreement.seller_fee_minor;
  if (amountMinor > balance.availableMinor) {
    throw errValidation(`Saldo insuficiente: disponible ${balance.availableMinor}, requerido ${amountMinor}`);
  }

  const order = createFinancialOrder(db, {
    orderId: id("fo"),
    operationId,
    orderType: "RELEASE",
    amountMinor: sellerNet,
    currency: agreement.currency,
    cause,
    causeRef: causeLabel,
    idempotencyKey: key,
  });
  updateOrderState(db, order.order_id, "SENT", { providerRef: `fake_rel_${order.order_id}` });

  // Registrar ledger (efecto simulado confirmado al instante en el fake).
  // Se debita el principal por el total, se acredita SELLER_PAYABLE por el neto y
  // SELLER_FEE_REVENUE por la comisión del vendedor.
  const policy = getFrozenPolicy(db, operationId);
  const policyVersion = policy ? "test-local" : undefined;
  postJournalEntry(db, {
    operationId,
    entryType: "RELEASE",
    currency: agreement.currency,
    cause: `release:${cause}`,
    causeRef: order.order_id,
    policyVersion,
    author: "system",
    postings: [
      { logicalAccount: "PROTECTED_PRINCIPAL", side: "DEBIT", amountMinor: amountMinor, currency: agreement.currency, component: "PRINCIPAL" },
      { logicalAccount: "SELLER_PAYABLE", side: "CREDIT", amountMinor: sellerNet, currency: agreement.currency, component: "PRINCIPAL" },
      { logicalAccount: "SELLER_FEE_REVENUE", side: "CREDIT", amountMinor: sellerFee, currency: agreement.currency, component: "SELLER_FEE" },
    ],
  }, { at: opts.at });

  updateOrderState(db, order.order_id, "CONFIRMED", { providerRef: `fake_rel_${order.order_id}` });
  updateOperationState(db, operationId, "COMPLETED", { reason: `Liberación confirmada (${causeLabel})` });
  pushOperationEvent(db, { operationId, actorId: "system", eventType: "release.confirmed", label: `Liberación al vendedor (${causeLabel})`, stateFrom: op.state, stateTo: "COMPLETED" });
  enqueueOutbox(db, { aggregateType: "operation", aggregateId: operationId, eventType: "release.confirmed", payload: { orderId: order.order_id } });
  recordAudit(db, { actorId: "system", action: "financial.release", resourceType: "operation", resourceId: operationId, reason: causeLabel });
  return { orderId: order.order_id };
}

/* ------------------------------------------------------------------ */
/* Reembolso (disputa o devolución)                                    */
/* ------------------------------------------------------------------ */
export function executeRefund(
  db: DatabaseSync,
  operationId: string,
  cause: string,
  causeLabel: string,
  amountMinorOverride?: number,
  opts: { at?: string } = {},
): { orderId: string } {
  const op = getOperation(db, operationId);
  if (!op) throw new Error("operation not found");
  assertNotHeld(db, operationId, "REEMBOLSAR");
  const agreement = db
    .prepare("SELECT currency, buyer_total_minor, base_amount_minor, buyer_fee_minor, seller_net_minor FROM agreement_version WHERE operation_id=? AND version=1")
    .get(operationId) as { currency: string; buyer_total_minor: number; base_amount_minor: number; buyer_fee_minor: number; seller_net_minor: number };
  if (!agreement) throw errValidation("Sin acuerdo");

  const amount = amountMinorOverride ?? agreement.buyer_total_minor;
  const balance = attributableBalance(db, operationId);
  // El reembolso puede incluir la comisión del comprador ya reconocida como ingreso:
  // se devuelve principal desde el saldo y la comisión se revierte de BUYER_FEE_REVENUE.
  const feeRecognized = agreement.buyer_fee_minor;
  const maxRefundable = balance.availableMinor + feeRecognized;
  if (amount > maxRefundable) {
    throw errValidation(`Saldo insuficiente para reembolsar: disponible ${balance.availableMinor}, requerido ${amount}`);
  }

  const key = `operation:${operationId}:refund:${cause}`;
  const existing = getOrderByIdempotencyKey(db, key);
  if (existing && existing.state === "CONFIRMED") return { orderId: existing.order_id };
  if (existing) throw errHeld(["ORDEN_FINANCIERA_INCIERTA"]);

  const order = createFinancialOrder(db, {
    orderId: id("fo"),
    operationId,
    orderType: "REFUND",
    amountMinor: amount,
    currency: agreement.currency,
    cause,
    causeRef: causeLabel,
    idempotencyKey: key,
  });
  updateOrderState(db, order.order_id, "SENT", { providerRef: `fake_ref_${order.order_id}` });

  // Asiento de reembolso: se devuelve el principal; si se devuelve el total pagado
  // (incluida la comisión del comprador), se revierte el ingreso de BUYER_FEE.
  const principal = Math.min(amount, agreement.base_amount_minor);
  const feeReturned = amount - principal; // parte de buyer_fee devuelta (si aplica)
  const postings: Array<{ logicalAccount: string; side: "DEBIT" | "CREDIT"; amountMinor: number; currency: string; component?: string }> = [
    { logicalAccount: "PROTECTED_PRINCIPAL", side: "DEBIT", amountMinor: principal, currency: agreement.currency, component: "PRINCIPAL" },
    { logicalAccount: "BUYER_REFUND_PAYABLE", side: "CREDIT", amountMinor: principal, currency: agreement.currency, component: "PRINCIPAL" },
  ];
  if (feeReturned > 0) {
    postings.push(
      { logicalAccount: "BUYER_FEE_REVENUE", side: "DEBIT", amountMinor: feeReturned, currency: agreement.currency, component: "BUYER_FEE" },
      { logicalAccount: "BUYER_REFUND_PAYABLE", side: "CREDIT", amountMinor: feeReturned, currency: agreement.currency, component: "BUYER_FEE" },
    );
  }
  postJournalEntry(db, {
    operationId,
    entryType: "REFUND",
    currency: agreement.currency,
    cause: `refund:${cause}`,
    causeRef: order.order_id,
    author: "system",
    postings,
  }, { at: opts.at });
  updateOrderState(db, order.order_id, "CONFIRMED", { providerRef: `fake_ref_${order.order_id}` });
  updateOperationState(db, operationId, "REFUNDED", { reason: `Reembolso confirmado (${causeLabel})` });
  pushOperationEvent(db, { operationId, actorId: "system", eventType: "refund.confirmed", label: `Reembolso al comprador (${causeLabel})`, stateFrom: op.state, stateTo: "REFUNDED" });
  enqueueOutbox(db, { aggregateType: "operation", aggregateId: operationId, eventType: "refund.confirmed", payload: { orderId: order.order_id } });
  recordAudit(db, { actorId: "system", action: "financial.refund", resourceType: "operation", resourceId: operationId, reason: causeLabel });
  return { orderId: order.order_id };
}
