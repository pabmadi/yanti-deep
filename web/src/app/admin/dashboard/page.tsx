import { redirect } from "next/navigation";
import { currentAdmin } from "@/ui/lib/session";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { RevenueChart } from "@/ui/components/charts/RevenueChart";
import { VolumeChart } from "@/ui/components/charts/VolumeChart";
import { OpsByStateChart } from "@/ui/components/charts/OpsByStateChart";
import { getDb } from "@/data/db";
import {
  getAdminKpis,
  getRevenueSeries,
  getVolumeSeries,
  getOpsByState,
  getRevenueByCountryCurrency,
  getDisputeMetrics,
} from "@/server/admin-metrics";
import { formatMoney } from "@/ui/lib/format";
import { formatDate } from "@/ui/lib/format";

export default async function AdminDashboardPage() {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const db = getDb();

  const kpis = getAdminKpis(db);
  const revenueSeries = getRevenueSeries(db, 12);
  const volumeSeries = getVolumeSeries(db, 12);
  const opsByState = getOpsByState(db);
  const byCountry = getRevenueByCountryCurrency(db);
  const disputes = getDisputeMetrics(db);

  const totalRevenue = formatMoney(kpis.totalRevenueMinor, kpis.currency);
  const buyerFee = formatMoney(kpis.buyerFeeMinor, kpis.currency);
  const sellerFee = formatMoney(kpis.sellerFeeMinor, kpis.currency);

  return (
    <>
      <h1>Dashboard de métricas</h1>
      <p className="text-secondary">Métricas de ganancias, volumen y operaciones. El dinero se lee del libro de doble entrada (ledger), no de estados mutables.</p>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Ingreso por comisiones</div>
          <div className="kpi-value">{totalRevenue}</div>
          <div className="kpi-sub">{buyerFee} comprador · {sellerFee} vendedor</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Operaciones completadas</div>
          <div className="kpi-value">{kpis.completedOps}</div>
          <div className="kpi-sub">{kpis.inFlightOps} en curso</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pagos por reconciliar</div>
          <div className="kpi-value">{kpis.pendingReconcile}</div>
          <div className="kpi-sub">Bandeja de consola</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Disputas abiertas</div>
          <div className="kpi-value">{kpis.openDisputes}</div>
          <div className="kpi-sub">{disputes.totalDisputes} totales</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Resolución media</div>
          <div className="kpi-value">
            {kpis.avgResolutionHours !== null ? `${Math.round(kpis.avgResolutionHours * 10) / 10} h` : "—"}
          </div>
          <div className="kpi-sub">Tiempo medio disputa → resolución</div>
        </div>
      </div>

      <div className="chart-card">
        <h2>Comisiones por mes (ingreso Yanti)</h2>
        <RevenueChart data={revenueSeries} />
        <p className="chart-tip">Suma neta (créditos − débitos) de BUYER_FEE_REVENUE y SELLER_FEE_REVENUE por fecha de asiento (ledger).</p>
      </div>

      <div className="chart-card">
        <h2>Volumen de operaciones completadas por mes</h2>
        <VolumeChart data={volumeSeries} />
        <p className="chart-tip">Operaciones con estado COMPLETADO, agrupadas por mes de cierre.</p>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="chart-card">
          <h2>Operaciones por estado</h2>
          <OpsByStateChart data={opsByState} />
        </div>
        <div className="chart-card">
          <h2>Comisiones por país / moneda</h2>
          {byCountry.length === 0 ? (
            <p className="text-secondary">Sin datos.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>País</th><th>Moneda</th><th>Comisiones</th></tr>
                </thead>
                <tbody>
                  {byCountry.map((r) => (
                    <tr key={`${r.countryCode}-${r.currency}`}>
                      <td>{r.countryCode}</td>
                      <td>{r.currency}</td>
                      <td className="money">{formatMoney(r.revenueMinor, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="chart-card">
        <h2>Disputas</h2>
        {disputes.outcomeCounts.length === 0 ? (
          <p className="text-secondary">Sin resoluciones todavía.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption>Resoluciones confirmadas por tipo de fallo</caption>
              <thead>
                <tr><th>Fallo</th><th>Cantidad</th></tr>
              </thead>
              <tbody>
                {disputes.outcomeCounts.map((o) => (
                  <tr key={o.outcome}>
                    <td>{o.outcome}</td>
                    <td>{o.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="chart-tip">Estado actual de la bandeja: {disputes.openDisputes} abiertas · {disputes.resolvedDisputes} resueltas.</p>
      </div>
    </>
  );
}
