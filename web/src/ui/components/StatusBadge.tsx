import { t } from "@/ui/lib/i18n";

/** Traduce el estado SM-OPS a texto legible (doc: el estado nunca se muestra solo con color). */
export function stateLabel(state: string): string {
  const key = state as keyof typeof t.status;
  return t.status[key] ?? state;
}

/** Variante de color semántico por estado para StatusBadge. */
export function stateTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" | "cyan" {
  switch (state) {
    case "COMPLETED":
    case "REFUNDED":
      return "success";
    case "CANCELLED":
    case "EXPIRED":
      return "neutral";
    case "IN_DISPUTE":
    case "RETURN_REQUIRED":
    case "EXCEPTION_REVIEW":
      return "danger";
    case "PAYMENT_IN_PROGRESS":
    case "RELEASE_IN_PROGRESS":
    case "REFUND_IN_PROGRESS":
    case "CONFIRMATION_OVERDUE":
      return "warning";
    case "PAID_AWAITING_SHIPMENT":
    case "SHIPPED_AWAITING_RECEIPT":
      return "cyan";
    default:
      return "info";
  }
}

export function StatusBadge({ state }: { state: string }) {
  const tone = stateTone(state);
  return (
    <span className={`status status-${tone}`} role="status">
      {stateLabel(state)}
    </span>
  );
}

export function RoleBadge({ role }: { role: "BUYER" | "SELLER" | undefined }) {
  if (!role) return null;
  return <span className="badge">{t.role[role]}</span>;
}
