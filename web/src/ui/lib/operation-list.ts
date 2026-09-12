import type { OperationState } from "@/domain/state-machines";

export type ViewerRole = "BUYER" | "SELLER";
export type OperationGroup = "action" | "waiting" | "finished";

export interface OperationListItem {
  operationId: string;
  supportCode: string;
  title: string;
  state: OperationState;
  role: ViewerRole;
  counterparty: string | null;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
  deadlineLabel: string | null;
  nextStep: string;
  group: OperationGroup;
  amountMinor: number;
  currency: string;
  amountLabel: "Total a pagar" | "Total pagado" | "Neto a recibir" | "Total acordado" | "Neto acordado" | "Monto base";
}

const FINISHED = new Set<OperationState>(["COMPLETED", "REFUNDED", "CANCELLED", "EXPIRED"]);

const ACTION_BY_ROLE: Record<ViewerRole, ReadonlySet<OperationState>> = {
  BUYER: new Set([
    "AWAITING_ACCEPTANCE",
    "ACCEPTED_AWAITING_PAYMENT",
    "PAYMENT_IN_PROGRESS",
    "SHIPPED_AWAITING_RECEIPT",
    "CONFIRMATION_OVERDUE",
    "IN_DISPUTE",
    "RETURN_REQUIRED",
  ]),
  SELLER: new Set(["DRAFT", "PAID_AWAITING_SHIPMENT", "IN_DISPUTE"]),
};

export function groupForOperation(state: OperationState, role: ViewerRole): OperationGroup {
  if (FINISHED.has(state)) return "finished";
  return ACTION_BY_ROLE[role].has(state) ? "action" : "waiting";
}

export function nextStepForOperation(state: OperationState, role: ViewerRole): string {
  if (role === "BUYER") {
    const steps: Partial<Record<OperationState, string>> = {
      DRAFT: "El vendedor está preparando la solicitud.",
      AWAITING_ACCEPTANCE: "Revisá y aceptá el acuerdo para continuar.",
      ACCEPTED_AWAITING_PAYMENT: "Realizá el pago para confirmar la compra.",
      PAYMENT_IN_PROGRESS: "Completá el pago o esperá la confirmación del proveedor.",
      PAID_AWAITING_SHIPMENT: "El vendedor debe despachar tu compra.",
      SHIPPED_AWAITING_RECEIPT: "Cuando llegue, confirmá la recepción o abrí un reclamo.",
      CONFIRMATION_OVERDUE: "Confirmá la recepción o abrí un reclamo.",
      IN_DISPUTE: "Revisá el reclamo y aportá la información solicitada.",
      RETURN_REQUIRED: "Revisá las instrucciones y enviá la devolución.",
      RELEASE_IN_PROGRESS: "Yanti está procesando la liberación al vendedor.",
      REFUND_IN_PROGRESS: "Yanti está procesando tu reembolso.",
      COMPLETED: "La operación terminó y el pago fue liberado.",
      REFUNDED: "La operación terminó con un reembolso.",
      CANCELLED: "La solicitud fue cancelada.",
      EXPIRED: "La solicitud venció antes del pago.",
      EXCEPTION_REVIEW: "El equipo de Yanti está revisando la operación.",
    };
    return steps[state] ?? "Revisá el detalle de la operación.";
  }

  const steps: Partial<Record<OperationState, string>> = {
    DRAFT: "Enviá la solicitud al comprador.",
    AWAITING_ACCEPTANCE: "El comprador debe aceptar el acuerdo.",
    ACCEPTED_AWAITING_PAYMENT: "El comprador debe realizar el pago.",
    PAYMENT_IN_PROGRESS: "Yanti está confirmando el pago.",
    PAID_AWAITING_SHIPMENT: "Despachá el producto e informá el seguimiento.",
    SHIPPED_AWAITING_RECEIPT: "El comprador debe confirmar la recepción.",
    CONFIRMATION_OVERDUE: "El comprador debe confirmar o abrir un reclamo.",
    IN_DISPUTE: "Revisá el reclamo y aportá la información solicitada.",
    RETURN_REQUIRED: "El comprador debe completar la devolución.",
    RELEASE_IN_PROGRESS: "Yanti está procesando tu cobro.",
    REFUND_IN_PROGRESS: "Yanti está procesando el reembolso al comprador.",
    COMPLETED: "La operación terminó y recibiste el neto acordado.",
    REFUNDED: "La operación terminó con un reembolso al comprador.",
    CANCELLED: "La solicitud fue cancelada.",
    EXPIRED: "La solicitud venció antes del pago.",
    EXCEPTION_REVIEW: "El equipo de Yanti está revisando la operación.",
  };
  return steps[state] ?? "Revisá el detalle de la operación.";
}

export function filterOperationItems(
  items: OperationListItem[],
  filters: { q?: string; group?: string },
): OperationListItem[] {
  const query = filters.q?.trim().toLocaleLowerCase("es") ?? "";
  const group = filters.group;
  return items.filter((item) => {
    const matchesQuery = !query || item.title.toLocaleLowerCase("es").includes(query) || item.supportCode.toLocaleLowerCase("es").includes(query);
    const matchesGroup = !group || group === "all" || item.group === group;
    return matchesQuery && matchesGroup;
  });
}

export const GROUP_LABELS: Record<OperationGroup, string> = {
  action: "Necesitás actuar",
  waiting: "Esperando",
  finished: "Finalizadas",
};
