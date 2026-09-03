"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

export interface StateDatum {
  state: string;
  count: number;
}

/** Colores por tone de estado (alineados con StatusBadge). */
const TONES: Record<string, string> = {
  success: "#0e7a47",
  warning: "#b45309",
  danger: "#c62828",
  info: "#1d6fa5",
  neutral: "#6b7280",
  cyan: "#0d9b9b",
};

/** Traducción + tone por estado (duplicado mínimo del mapeo de UI, sin importar i18n en client). */
const STATE_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  AWAITING_ACCEPTANCE: "Pendiente aceptación",
  ACCEPTED_AWAITING_PAYMENT: "Aceptada · pago",
  PAYMENT_IN_PROGRESS: "Pago en proceso",
  PAID_AWAITING_SHIPMENT: "Pagada · envío",
  SHIPPED_AWAITING_RECEIPT: "Enviada · confirmación",
  CONFIRMATION_OVERDUE: "Confirmación vencida",
  IN_DISPUTE: "En disputa",
  RETURN_REQUIRED: "Devolución requerida",
  RELEASE_IN_PROGRESS: "Liberación en proceso",
  REFUND_IN_PROGRESS: "Reembolso en proceso",
  COMPLETED: "Completada",
  REFUNDED: "Reembolsada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  EXCEPTION_REVIEW: "Revisión excepcional",
};

const STATE_TONE: Record<string, keyof typeof TONES> = {
  COMPLETED: "success",
  REFUNDED: "success",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  IN_DISPUTE: "danger",
  RETURN_REQUIRED: "danger",
  EXCEPTION_REVIEW: "danger",
  PAYMENT_IN_PROGRESS: "warning",
  RELEASE_IN_PROGRESS: "warning",
  REFUND_IN_PROGRESS: "warning",
  CONFIRMATION_OVERDUE: "warning",
  PAID_AWAITING_SHIPMENT: "cyan",
  SHIPPED_AWAITING_RECEIPT: "cyan",
};

/** Donut de operaciones por estado. */
export function OpsByStateChart({ data }: { data: StateDatum[] }) {
  if (data.length === 0) {
    return <p className="text-secondary">Sin operaciones todavía.</p>;
  }
  const rows = data.map((d) => ({
    ...d,
    label: STATE_LABEL[d.state] ?? d.state,
    color: TONES[STATE_TONE[d.state] ?? "info"],
  }));
  return (
    <div role="img" aria-label="Operaciones por estado">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {rows.map((r) => (
              <Cell key={r.state} fill={r.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
