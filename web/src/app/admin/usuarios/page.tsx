import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/ui/lib/session";
import { getDb } from "@/data/db";
import { listUsers } from "@/server/admin-queries";
import { ACCOUNT_STATUSES } from "@/server/admin-users";
import { formatDate } from "@/ui/lib/format";

export default async function AdminUsuariosPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const sp = await searchParams;
  const db = getDb();

  const q = sp.q ?? "";
  const estado = ACCOUNT_STATUSES.includes((sp.estado ?? "") as never) ? sp.estado! : "";
  const users = listUsers(db, { q, status: estado || undefined });

  return (
    <>
      <h1>Usuarios</h1>
      <p className="text-secondary">Buscar cuentas y administrar su estado. Toda restricción exige motivo y queda auditada.</p>

      <form method="get" className="flex" style={{ gap: 8, marginBottom: "var(--space-4)" }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="visually-hidden" htmlFor="q">Buscar por nombre o correo</label>
          <input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre o correo" />
        </div>
        <div className="field">
          <label className="visually-hidden" htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado}>
            <option value="">Todos los estados</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">Filtrar</button>
      </form>

      <div className="table-wrap">
        <table>
          <caption>Cuentas registradas</caption>
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Admin</th><th>Operaciones</th><th>Creada</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.account_id}>
                <td><Link href={`/admin/usuarios/${u.account_id}`}>{u.display_name}</Link></td>
                <td>{u.email_canonical}</td>
                <td>{u.status}</td>
                <td>{u.is_admin ? "Sí" : "No"}</td>
                <td>{u.ops_count}</td>
                <td>{formatDate(u.created_at)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
