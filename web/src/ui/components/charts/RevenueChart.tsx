"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface RevenueChartDatum {
  month: string;
  buyerFeeMinor: number;
  sellerFeeMinor: number;
}

/** Barras apiladas de comisiones por mes (valores en unidades menores). */
export function RevenueChart({ data }: { data: RevenueChartDatum[] }) {
  if (data.length === 0) {
    return <p className="text-secondary">Sin datos de comisiones todavía.</p>;
  }
  const fmt = (v: number) => `$ ${(v / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  return (
    <div role="img" aria-label="Comisiones (ingreso de Yanti) por mes">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--yanti-border-default)" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => (v / 1000).toLocaleString("es-AR") + "k"} width={60} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => fmt(Number(value))} labelFormatter={(l) => `Mes ${l}`} />
          <Legend />
          <Bar dataKey="buyerFeeMinor" name="Comisión comprador" stackId="a" fill="var(--yanti-action-primary)" />
          <Bar dataKey="sellerFeeMinor" name="Comisión vendedor" stackId="a" fill="var(--yanti-action-secondary, #02a3a3)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
