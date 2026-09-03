import { notFound, redirect } from "next/navigation";
import { currentAdmin } from "@/ui/lib/session";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { getDb } from "@/data/db";
import { getUserDetail } from "@/server/admin-queries";
import { ACCOUNT_STATUSES } from "@/server/admin-users";
import { setAccountStatusAction } from "@/ui/actions/admin-users-actions";
import { formatDate } from "@/ui/lib/format";

export default async function AdminUsuarioDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cambiado?: string }>;
}) {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();

  const detail = getUserDetail(db, id);
  if (!detail) notFound();
  const u = detail.account;
  const isSelf = u.account_id === account.account_id;

  return (
    <>
      <h1>Usuario</h1>
      {sp.cambiado && <div className="banner banner-success">Estado de cuenta actualizado.</div>}
      <p className="text-secondary"><a href="/admin/usuarios">← Volver a usuarios</a></p>

      <div className="card">
        <h2>{u.display_name}</h2>
        <dl className="dl">
          <div><dt>Correo</dt><dd>{u.email_canonical}</dd></div>
          <div><dt>Estado</dt><dd><StatusBadge state={u.status} /></dd></div>
          <div><dt>Rol</dt><dd>{u.is_admin ? "Administrador" : "Participante"}</dd></div>
          <div><dt>País</dt><dd>{u.country ?? "—"}</dd></div>
          <div><dt>Zona horaria</dt><dd>{u.timezone}</dd></div>
          <div><dt>Creada</dt><dd>{formatDate(u.created_at)}</dd></div>
          <div><dt>Operaciones</dt><dd>{detail.ops_count} ({detail.as_buyer} como comprador · {detail.as_seller} como vendedor)</dd></div>
          <div><dt>Reclamos</dt><dd>{detail.disputes_involved} involucrado · {detail.disputes_opened} abiertos</dd></div>
          <div><dt>Calificaciones recibidas</dt><dd>{detail.ratings_received}</dd></div>
        </dl>
      </div>

      {!u.is_admin && !isSelf && (
        <div className="card mt-3">
          <h2>Cambiar estado de cuenta</h2>
          <p className="text-secondary">Restringir limita el acceso de la cuenta (los magic links se rechazan si no está ACTIVE).</p>
          <form action={setAccountStatusAction} className="flex-col" style={{ gap: 12 }}>
            <input type="hidden" name="accountId" value={u.account_id} />
            <div className="field">
              <label htmlFor="status">Nuevo estado</label>
              <select id="status" name="status" defaultValue={u.status}>
                {ACCOUNT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="reason">Motivo (obligatorio)</label>
              <textarea id="reason" name="reason" rows={2} required placeholder="Motivo estructurado del cambio (queda en auditoría)"></textarea>
            </div>
            <button className="btn btn-danger btn-sm" type="submit" style={{ alignSelf: "flex-start" }}>Guardar estado</button>
          </form>
        </div>
      )}
      {isSelf && <p className="text-secondary mt-3">No podés cambiar tu propio estado desde esta pantalla.</p>}
    </>
  );
}
