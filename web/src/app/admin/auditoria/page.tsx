import { redirect } from "next/navigation";
import { currentAdmin } from "@/ui/lib/session";
import { getDb } from "@/data/db";
import { asRows } from "@/data/db";
import { formatDate } from "@/ui/lib/format";
import { t } from "@/ui/lib/i18n";

export default async function AuditoriaPage() {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const db = getDb();
  const records = asRows<{
    audit_id: string;
    actor_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string;
    reason: string | null;
    created_at: string;
  }>(
    db.prepare("SELECT audit_id, actor_id, action, resource_type, resource_id, reason, created_at FROM audit_record ORDER BY created_at DESC LIMIT 100").all(),
  );

  return (
    <>
      <h1>{t.admin.audit}</h1>
        <p className="text-secondary">Registro de auditoría append-only (últimos 100 eventos).</p>
        <div className="table-wrap">
          <table>
            <caption>Auditoría de acciones del sistema</caption>
            <thead>
              <tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Recurso</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.audit_id}>
                  <td>{formatDate(r.created_at)}</td>
                  <td>{r.actor_id ?? "system"}</td>
                  <td>{r.action}</td>
                  <td>{r.resource_type}/{r.resource_id}</td>
                  <td>{r.reason ?? ""}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={5}>Sin eventos todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
    </>
  );
}
