/**
 * Máquinas de estado de Yanti — traducción directa de doc/03 (SM-OPS, SM-PAG, SM-ENV,
 * SM-DIS, SM-DEV, SM-FIN, SM-SET) y sus invariantes. Los estados y transiciones son la
 * fuente de verdad para toda transición de dominio: NO existe "editar estado".
 */

/* ------------------------------------------------------------------ */
/* SM-OPS: estado coordinador de la operación                          */
/* ------------------------------------------------------------------ */
export const OPS_STATES = [
  "DRAFT", // Borrador (vendedor edita; no notificado)
  "AWAITING_ACCEPTANCE", // Pendiente de aceptación/pago
  "ACCEPTED_AWAITING_PAYMENT", // Aceptada, pendiente de pago
  "PAYMENT_IN_PROGRESS", // Pago en proceso (intento no terminal)
  "PAID_AWAITING_SHIPMENT", // Pagada, pendiente de envío
  "SHIPPED_AWAITING_RECEIPT", // Enviada, pendiente de recepción
  "CONFIRMATION_OVERDUE", // Hito de confirmación vencido (gracia/recordatorios)
  "IN_DISPUTE", // Reclamo abierto; liberación suspendida
  "RETURN_REQUIRED", // Resolución exige devolución antes de reembolso
  "RELEASE_IN_PROGRESS", // Liberación iniciada al vendedor
  "REFUND_IN_PROGRESS", // Reembolso iniciado al comprador
  "COMPLETED", // Terminal: liberación confirmada
  "REFUNDED", // Terminal: reembolso confirmado
  "CANCELLED", // Terminal: cancelada antes de pago acreditado
  "EXPIRED", // Terminal: venció antes de pago válido
  "EXCEPTION_REVIEW", // No terminal: anomalía; requiere operaciones
] as const;
export type OperationState = (typeof OPS_STATES)[number];

export const OPS_TERMINAL: ReadonlySet<string> = new Set([
  "COMPLETED",
  "REFUNDED",
  "CANCELLED",
  "EXPIRED",
]);

/** Transiciones válidas SM-OPS. Fuente: doc 03 §SM-OPS. */
const OPS_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  // Creación y envío
  "->DRAFT": new Set([]),
  "DRAFT->AWAITING_ACCEPTANCE": new Set(["V", "S"]),
  "AWAITING_ACCEPTANCE->ACCEPTED_AWAITING_PAYMENT": new Set(["C"]),
  "AWAITING_ACCEPTANCE->CANCELLED": new Set(["V", "A"]),
  "AWAITING_ACCEPTANCE->EXPIRED": new Set(["S"]),
  "ACCEPTED_AWAITING_PAYMENT->EXPIRED": new Set(["S"]),
  // Pago
  "ACCEPTED_AWAITING_PAYMENT->PAYMENT_IN_PROGRESS": new Set(["C", "S"]),
  "PAYMENT_IN_PROGRESS->ACCEPTED_AWAITING_PAYMENT": new Set(["S"]), // intento no acreditado
  "PAYMENT_IN_PROGRESS->PAID_AWAITING_SHIPMENT": new Set(["S"]), // acreditación conciliada
  "ACCEPTED_AWAITING_PAYMENT->PAID_AWAITING_SHIPMENT": new Set(["S"]),
  // Envío
  "PAID_AWAITING_SHIPMENT->SHIPPED_AWAITING_RECEIPT": new Set(["V"]),
  // Confirmación / gracia
  "SHIPPED_AWAITING_RECEIPT->CONFIRMATION_OVERDUE": new Set(["S"]),
  "SHIPPED_AWAITING_RECEIPT->RELEASE_IN_PROGRESS": new Set(["S", "C"]),
  "CONFIRMATION_OVERDUE->RELEASE_IN_PROGRESS": new Set(["S"]),
  // Disputa
  "AWAITING_ACCEPTANCE->IN_DISPUTE": new Set([]), // no: no hay pago aún
  "PAID_AWAITING_SHIPMENT->IN_DISPUTE": new Set(["C"]),
  "SHIPPED_AWAITING_RECEIPT->IN_DISPUTE": new Set(["C"]),
  "CONFIRMATION_OVERDUE->IN_DISPUTE": new Set(["C"]),
  "RELEASE_IN_PROGRESS->IN_DISPUTE": new Set([]), // no: movimiento ya irreversible
  // Resolución de disputa
  "IN_DISPUTE->RELEASE_IN_PROGRESS": new Set(["A", "S"]), // fallo "liberar"
  "IN_DISPUTE->REFUND_IN_PROGRESS": new Set(["A", "S"]), // fallo "reembolsar sin devolución"
  "IN_DISPUTE->RETURN_REQUIRED": new Set(["A", "S"]), // fallo "exigir devolución"
  // Devolución
  "RETURN_REQUIRED->REFUND_IN_PROGRESS": new Set(["A", "S"]), // hito cumplido
  "RETURN_REQUIRED->RELEASE_IN_PROGRESS": new Set(["A", "S"]), // consecuencia escrita
  // Movimientos
  "RELEASE_IN_PROGRESS->COMPLETED": new Set(["S"]), // orden CONFIRMADA
  "REFUND_IN_PROGRESS->REFUNDED": new Set(["S"]), // orden CONFIRMADA
  // Revisión excepcional (solo desde no terminal)
  "PAID_AWAITING_SHIPMENT->EXCEPTION_REVIEW": new Set(["A", "S"]),
  "SHIPPED_AWAITING_RECEIPT->EXCEPTION_REVIEW": new Set(["A", "S"]),
  "CONFIRMATION_OVERDUE->EXCEPTION_REVIEW": new Set(["A", "S"]),
  "IN_DISPUTE->EXCEPTION_REVIEW": new Set(["A", "S"]),
  "RETURN_REQUIRED->EXCEPTION_REVIEW": new Set(["A", "S"]),
  "EXCEPTION_REVIEW->PAID_AWAITING_SHIPMENT": new Set(["A", "S"]),
  "EXCEPTION_REVIEW->SHIPPED_AWAITING_RECEIPT": new Set(["A", "S"]),
  "EXCEPTION_REVIEW->IN_DISPUTE": new Set(["A", "S"]),
  "EXCEPTION_REVIEW->RETURN_REQUIRED": new Set(["A", "S"]),
};

export function canTransitionOps(from: OperationState, to: OperationState): boolean {
  const key = `${from}->${to}`;
  return Object.prototype.hasOwnProperty.call(OPS_TRANSITIONS, key);
}

export function assertTransitionOps(from: OperationState, to: OperationState): void {
  if (!canTransitionOps(from, to)) {
    throw new Error(`Transición SM-OPS inválida: ${from} -> ${to}`);
  }
}

export const isTerminalOps = (s: OperationState): boolean => OPS_TERMINAL.has(s);

/* ------------------------------------------------------------------ */
/* SM-PAG: intento de pago                                             */
/* ------------------------------------------------------------------ */
export const PAG_STATES = [
  "CREATED",
  "PENDING_USER_PROVIDER",
  "UNDER_REVIEW",
  "ACCREDITED_PENDING_RECONCILIATION",
  "ACCREDITED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "INCONSISTENT",
] as const;
export type PaymentAttemptState = (typeof PAG_STATES)[number];

const PAG_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  "CREATED->PENDING_USER_PROVIDER": new Set(["S"]),
  "PENDING_USER_PROVIDER->ACCREDITED_PENDING_RECONCILIATION": new Set(["S"]), // webhook/consulta
  "PENDING_USER_PROVIDER->REJECTED": new Set(["S"]),
  "PENDING_USER_PROVIDER->CANCELLED": new Set(["S", "C"]),
  "PENDING_USER_PROVIDER->EXPIRED": new Set(["S"]),
  "PENDING_USER_PROVIDER->INCONSISTENT": new Set(["S"]),
  "ACCREDITED_PENDING_RECONCILIATION->ACCREDITED": new Set(["S"]), // conciliación ok
  "ACCREDITED_PENDING_RECONCILIATION->INCONSISTENT": new Set(["S"]),
};

export function canTransitionPag(from: PaymentAttemptState, to: PaymentAttemptState): boolean {
  const key = `${from}->${to}`;
  return Object.prototype.hasOwnProperty.call(PAG_TRANSITIONS, key);
}

/* ------------------------------------------------------------------ */
/* SM-ENV: envío                                                       */
/* ------------------------------------------------------------------ */
export const ENV_STATES = ["NOT_STARTED", "DRAFT", "DECLARED", "IN_TRACKING", "DELIVERY_REPORTED", "CLOSED", "INCIDENCE"] as const;
export type ShipmentState = (typeof ENV_STATES)[number];

/* ------------------------------------------------------------------ */
/* SM-DIS: disputa                                                     */
/* ------------------------------------------------------------------ */
export const DIS_STATES = [
  "OPEN",
  "AWAITING_RESPONSE",
  "COLLECTING_EVIDENCE",
  "UNDER_REVIEW",
  "AWAITING_INFORMATION",
  "PROPOSED_RESOLUTION",
  "PENDING_SECOND_APPROVAL",
  "RESOLVED_RELEASE",
  "RESOLVED_REFUND",
  "RESOLVED_RETURN",
  "RESOLVED_AGREEMENT",
] as const;
export type DisputeState = (typeof DIS_STATES)[number];

export const DIS_TERMINAL: ReadonlySet<string> = new Set([
  "RESOLVED_RELEASE",
  "RESOLVED_REFUND",
  "RESOLVED_RETURN",
  "RESOLVED_AGREEMENT",
]);

/* ------------------------------------------------------------------ */
/* SM-FIN: orden financiera                                            */
/* ------------------------------------------------------------------ */
export const FIN_STATES = [
  "INTENTION_RECORDED",
  "READY_TO_SEND",
  "SENT",
  "PENDING_CONFIRMATION",
  "RESULT_UNKNOWN", // prohíbe reenvío ciego: consultar antes
  "CONFIRMED",
  "REJECTED",
  "FAILED_RETRYABLE",
  "MANUAL_REVIEW",
  "CANCELLED_BEFORE_SEND",
] as const;
export type FinancialOrderState = (typeof FIN_STATES)[number];

export const FIN_ORDER_TYPE = ["RELEASE", "REFUND", "AUTHORIZED_ADJUSTMENT"] as const;
export type FinancialOrderType = (typeof FIN_ORDER_TYPE)[number];

/* ------------------------------------------------------------------ */
/* Holds: acciones bloqueadas                                          */
/* ------------------------------------------------------------------ */
export const HOLD_ACTIONS = ["INICIAR_ENVIO", "LIBERAR", "REEMBOLSAR", "CERRAR"] as const;
export type HeldAction = (typeof HOLD_ACTIONS)[number];

export const HOLD_TYPES = [
  "DISPUTA_ABIERTA",
  "RIESGO",
  "CONTRACARGO",
  "PAGO_INCONSISTENTE",
  "ORDEN_FINANCIERA_INCIERTA",
  "INCIDENCIA_ENVIO",
  "INCIDENCIA_DEVOLUCION",
  "ADMINISTRATIVA",
  "CAPACIDAD_PROVEEDOR_NO_VERIFICADA",
  "REVISION_PAGO_TARDIO",
] as const;
export type HoldType = (typeof HOLD_TYPES)[number];

/** Retenciones que bloquean cada acción. Conjunto, no booleano. */
export const HOLDS_BLOCKING: Record<HeldAction, readonly HoldType[]> = {
  INICIAR_ENVIO: ["RIESGO", "CONTRACARGO", "PAGO_INCONSISTENTE", "ADMINISTRATIVA", "CAPACIDAD_PROVEEDOR_NO_VERIFICADA", "REVISION_PAGO_TARDIO"],
  LIBERAR: ["DISPUTA_ABIERTA", "RIESGO", "CONTRACARGO", "PAGO_INCONSISTENTE", "ORDEN_FINANCIERA_INCIERTA", "ADMINISTRATIVA", "INCIDENCIA_ENVIO", "INCIDENCIA_DEVOLUCION", "CAPACIDAD_PROVEEDOR_NO_VERIFICADA", "REVISION_PAGO_TARDIO"],
  REEMBOLSAR: ["RIESGO", "CONTRACARGO", "PAGO_INCONSISTENTE", "ORDEN_FINANCIERA_INCIERTA", "ADMINISTRATIVA", "CAPACIDAD_PROVEEDOR_NO_VERIFICADA", "REVISION_PAGO_TARDIO"],
  CERRAR: ["RIESGO", "CONTRACARGO", "PAGO_INCONSISTENTE", "ORDEN_FINANCIERA_INCIERTA", "ADMINISTRATIVA", "CAPACIDAD_PROVEEDOR_NO_VERIFICADA", "REVISION_PAGO_TARDIO"],
};

/* ------------------------------------------------------------------ */
/* Tipos de reclamo (doc 02: motivo de disputa)                        */
/* ------------------------------------------------------------------ */
export const DISPUTE_REASONS = [
  "NOT_RECEIVED",
  "DIFFERENT_ITEM",
  "DAMAGED",
  "MISSING_PARTS",
  "UNDISCLOSED_CONDITION",
  "OTHER",
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const RESOLUTION_OUTCOMES = ["RELEASE_TO_SELLER", "REFUND_WITHOUT_RETURN", "REQUIRE_RETURN", "AGREEMENT"] as const;
export type ResolutionOutcome = (typeof RESOLUTION_OUTCOMES)[number];

/** Operación visible derivada de hechos (doc 02 §5.2). */
export const RATING_STATES = ["NOT_ELIGIBLE", "ELIGIBLE", "DRAFT", "SUBMITTED_HIDDEN", "PUBLISHABLE", "PUBLISHED"] as const;
export type RatingState = (typeof RATING_STATES)[number];
