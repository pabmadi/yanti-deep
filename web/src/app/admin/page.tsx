import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/ui/lib/session";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { getDb } from "@/data/db";
import { asRows } from "@/data/db";
import { listOpenDisputes } from "@/server/disputes";
import { listActiveReturnsAdmin } from "@/server/admin-queries";
import { formatMoney } from "@/ui/lib/format";
import { formatDate } from "@/ui/lib/format";
import { reconcilePaymentAction } from "@/ui/actions/admin-actions";
import { getTranslations } from "@/ui/lib/i18n";
import { currentLocale } from "@/ui/lib/preferences";

const RETURN_STATE_LABELS: Record<string, string> = {
  INSTRUCTIONS_ISSUED: "Instrucciones emitidas",
  PREPARING: "Preparando devolución",
  DISPATCHED: "Despachada",
  IN_TRANSIT: "En tránsito",
};

export default async function AdminHubPage({ searchParams }: { searchParams: Promise<{ reconciliado?: string; resuelta?: string }> }) {
  const t = getTranslations(await currentLocale());
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const db = getDb();
  const sp = await searchParams;

  // Resumen para el hub (métricas "en vivo" de la consola operativa).
  const pendingReconcile = asRows<{ attempt_id: string; operation_id: string; requested_total_minor: number; currency: string }>(
    db
      .prepare(
        `SELECT pa.attempt_id, pa.operation_id, pa.requested_total_minor, pa.currency
         FROM payment_attempt pa JOIN operation o ON o.operation_id = pa.operation_id
         WHERE pa.state='ACCREDITED_PENDING_RECONCILIATION' AND o.state='PAYMENT_IN_PROGRESS'
         ORDER BY pa.updated_at ASC`,
      )
      .all(),
  );
  const openDisputes = listOpenDisputes(db);
  const pendingReturns = listActiveReturnsAdmin(db);

  return (
    <>
      {sp.reconciliado && <div className="banner banner-success">Pago reconciliado y acreditado.</div>}
      {sp.resuelta === "1" && <div className="banner banner-success">Resolución confirmada y ejecutada.</div>}

      <h1>{t.admin.title}</h1>
      <p className="text-secondary">Panel de administración de Yanti. Elegí una sección.</p>

      {/* Accesos rápidos operativos */}
      <div className="card mt-3">
        <h2>Pagos por reconciliar</h2>
        {pendingReconcile.length === 0 ? (
          <p className="text-secondary">No hay pagos pendientes de reconciliación.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption>Pagos acreditados por el proveedor que requieren conciliación antes de habilitar el envío</caption>
              <thead>
                <tr><th>Operación</th><th>Total</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {pendingReconcile.map((p) => (
                  <tr key={p.attempt_id}>
                    <td>
                      <Link href={`/admin/operaciones/${p.operation_id}`}>{p.operation_id}</Link>
                    </td>
                    <td className="money">{formatMoney(p.requested_total_minor, p.currency)}</td>
                    <td><StatusBadge state="PAYMENT_IN_PROGRESS" /></td>
                    <td>
                      <form action={reconcilePaymentAction}>
                        <input type="hidden" name="operationId" value={p.operation_id} />
                        <button className="btn btn-primary btn-sm" type="submit">Reconciliar y acreditar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-3">
        <div className="flex-between">
          <h2>Devoluciones pendientes</h2>
          <span className="admin-tile-metric warn">{pendingReturns.length} activa(s)</span>
        </div>
        {pendingReturns.length === 0 ? (
          <p className="text-secondary">No hay devoluciones pendientes.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption>Devoluciones activas que requieren seguimiento</caption>
              <thead>
                <tr><th>Producto</th><th>Código de soporte</th><th>Estado</th><th>Vence (UTC)</th><th></th></tr>
              </thead>
              <tbody>
                {pendingReturns.map((r) => (
                  <tr key={r.return_id}>
                    <td>{r.title}</td>
                    <td>{r.support_code}</td>
                    <td><span className="status status-info" role="status">{RETURN_STATE_LABELS[r.state] ?? r.state.replace(/_/g, " ")}</span></td>
                    <td>{r.deadline ? formatDate(r.deadline) : "—"}</td>
                    <td>
                      <Link href={`/admin/operaciones/${r.operation_id}`} className="btn btn-secondary btn-sm">
                        Ver operación
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-3">
        <h2>{t.admin.inbox}</h2>
        {openDisputes.length === 0 ? (
          <p className="text-secondary">No hay disputas abiertas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption>Reclamos abiertos que requieren resolución</caption>
              <thead>
                <tr><th>Código</th><th>Operación</th><th>Motivo</th><th>Abierto</th><th></th></tr>
              </thead>
              <tbody>
                {openDisputes.map((d) => (
                  <tr key={d.dispute.dispute_id}>
                    <td>{d.supportCode}</td>
                    <td>{d.title}</td>
                    <td>{t.dispute.reasons[d.dispute.reason as keyof typeof t.dispute.reasons] ?? d.dispute.reason}</td>
                    <td>{formatDate(d.dispute.opened_at)}</td>
                    <td>
                      <Link href={`/admin/operaciones/${d.operationId}`} className="btn btn-secondary btn-sm">
                        Revisar y resolver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Secciones del panel */}
      <h2 className="mt-4">Secciones</h2>
      <div className="admin-grid">
        <Link href="/admin/dashboard" className="admin-tile">
          <h2>Dashboard de métricas</h2>
          <p>Ganancias, volumen, operaciones por estado y disputas.</p>
        </Link>
        <Link href="/admin/usuarios" className="admin-tile">
          <h2>Usuarios</h2>
          <p>Buscar cuentas y administrar su estado (limitar, suspender, bloquear).</p>
        </Link>
        <Link href="/admin/catalogos" className="admin-tile">
          <h2>Catálogos</h2>
          <p>Administrar categorías y países habilitados.</p>
        </Link>
        <Link href="/admin/configuracion" className="admin-tile">
          <h2>Configuración</h2>
          <p>Comisiones (políticas versionadas) y plazos de cierre de operaciones.</p>
        </Link>
        <Link href="/admin/auditoria" className="admin-tile">
          <h2>Auditoría</h2>
          <p>Registro inmutable de acciones administrativas.</p>
        </Link>
      </div>
    </>
  );
}
