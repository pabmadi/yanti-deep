import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/ui/lib/session";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { getDb } from "@/data/db";
import { asRows } from "@/data/db";
import { listOpenDisputes } from "@/server/disputes";
import { formatMoney } from "@/ui/lib/format";
import { formatDate } from "@/ui/lib/format";
import { reconcilePaymentAction } from "@/ui/actions/admin-actions";
import { t } from "@/ui/lib/i18n";

export default async function AdminHubPage({ searchParams }: { searchParams: Promise<{ reconciliado?: string; resuelta?: string }> }) {
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
  const pendingReturns = asRows<{ return_id: string; operation_id: string }>(
    db
      .prepare(
        `SELECT rc.return_id, rc.operation_id FROM return_case rc JOIN operation o ON o.operation_id = rc.operation_id
         WHERE rc.state NOT IN ('RECIBIDA_CONFORME','CLOSED_REFUND','CLOSED_CONSEQUENCE') AND o.state='RETURN_REQUIRED'
         ORDER BY rc.created_at ASC`,
      )
      .all(),
  );
  const firstReturnOp = pendingReturns[0]?.operation_id;

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
        {pendingReturns.length > 0 && firstReturnOp && (
          <Link href={`/admin/operaciones/${firstReturnOp}`} className="admin-tile">
            <h2>Devoluciones pendientes</h2>
            <p>Hay devoluciones por registrar recepción conforme.</p>
            <span className="admin-tile-metric warn">{pendingReturns.length} activa(s)</span>
          </Link>
        )}
      </div>
    </>
  );
}
