const PAYMENT_STATUS_LABELS: Record<string, string> = {
  CREATED: "Pago iniciado",
  PENDING_USER_PROVIDER: "Esperando que completes el pago",
  UNDER_REVIEW: "Pago en revisión",
  ACCREDITED_PENDING_RECONCILIATION: "Pago informado, pendiente de verificación",
  ACCREDITED: "Pago acreditado",
  REJECTED: "Pago rechazado",
  CANCELLED: "Pago cancelado",
  EXPIRED: "Intento de pago vencido",
  INCONSISTENT: "Pago con datos por verificar",
};

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Reclamo abierto",
  AWAITING_RESPONSE: "Esperando respuesta",
  COLLECTING_EVIDENCE: "Recopilando evidencia",
  UNDER_REVIEW: "En revisión",
  AWAITING_INFORMATION: "Esperando información",
  PROPOSED_RESOLUTION: "Resolución propuesta",
  PENDING_SECOND_APPROVAL: "Pendiente de segunda aprobación",
  RESOLVED_RELEASE: "Resuelto a favor del vendedor",
  RESOLVED_REFUND: "Resuelto con reembolso al comprador",
  RESOLVED_RETURN: "Resuelto con devolución",
  RESOLVED_AGREEMENT: "Resuelto por acuerdo",
};

export function paymentStatusLabel(state: string): string {
  return PAYMENT_STATUS_LABELS[state] ?? "Estado de pago por verificar";
}

export function disputeStatusLabel(state: string): string {
  return DISPUTE_STATUS_LABELS[state] ?? "Estado del reclamo por verificar";
}
