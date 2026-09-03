"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface VolumeChartDatum {
  month: string;
  completedCount: number;
  baseVolumeMinor: number;
}

/** Barras de volumen (monto base) y operaciones completadas por mes. */
export function VolumeChart({ data }: { data: VolumeChartDatum[] }) {
  if (data.length === 0) {
    return <p className="text-secondary">Sin operaciones completadas todavía.</p>;
  }
  return (
    <div role="img" aria-label="Volumen de operaciones completadas por mes">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--yanti-border-default)" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => (v / 1000).toLocaleString("es-AR") + "k"} width={60} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value, name) => [
              name === "baseVolumeMinor"
                ? `$ ${(Number(value) / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
                : String(value),
              name === "baseVolumeMinor" ? "Monto base" : "Operaciones",
            ]}
          />
          <Bar dataKey="completedCount" name="Operaciones" fill="var(--yanti-action-primary)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
