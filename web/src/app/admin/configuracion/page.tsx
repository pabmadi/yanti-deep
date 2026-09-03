import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/ui/lib/session";
import { getDb } from "@/data/db";
import { listPolicies } from "@/server/admin-policy";
import { listSettingsAdmin } from "@/server/admin-queries";
import { updateSettingAction } from "@/ui/actions/admin-policy-actions";
import { formatDate } from "@/ui/lib/format";
import { StatusBadge } from "@/ui/components/StatusBadge";

/** Catálogo de parámetros operativos administrables (plazos de negocio). */
const SETTING_DEFS: Record<string, { label: string; description: string; suffix?: string }> = {
  delivery_days: { label: "Días de entrega estimada", description: "Plazo máximo desde el despacho para que el comprador confirme (RF-ENV-003).", suffix: "días" },
  request_expiry_days: { label: "Vencimiento de solicitud", description: "Días hasta que expira una solicitud enviada sin pagar (RF-OPS-009).", suffix: "días" },
  confirmation_grace_days: { label: "Gracia de confirmación", description: "Recordatorios diarios y días de gracia antes de evaluar liberación automática (RF-CON-003/004).", suffix: "días" },
  dispute_second_approval_threshold_minor: { label: "Umbral doble aprobación", description: "Monto (en unidades menores) desde el cual una resolución exige segunda aprobación (RF-DIS-012)." },
};

export default async function AdminConfigPage({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const db = getDb();
  const sp = await searchParams;

  const policies = listPolicies(db);
  const settings = listSettingsAdmin(db);
  const settingMap = new Map(settings.map((s) => [s.setting_key, s]));

  return (
    <>
      <h1>Configuración</h1>
      <p className="text-secondary">Políticas de comisión versionadas y parámetros de plazos. Ningún cambio es retroactivo: solo afecta operaciones futuras.</p>
      {sp.guardado && <div className="banner banner-success">Configuración guardada.</div>}

      <div className="card mt-3">
        <h2>Políticas de comisión</h2>
        {policies.length === 0 ? (
          <p className="text-secondary">Sin políticas registradas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption>Versiones de política por ámbito</caption>
              <thead>
                <tr><th>Ámbito</th><th>Versión</th><th>Comprador</th><th>Vendedor</th><th>Estado</th><th>Vigente desde</th><th></th></tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.policy_id}>
                    <td>{p.country_code}/{p.currency}/{p.category_code}</td>
                    <td>v{p.version}</td>
                    <td>{((p.buyer_rate_num / p.buyer_rate_den) * 100).toFixed(2)}%</td>
                    <td>{((p.seller_rate_num / p.seller_rate_den) * 100).toFixed(2)}%</td>
                    <td><StatusBadge state={p.status === "ACTIVE" ? "COMPLETED" : p.status === "DRAFT" ? "PAYMENT_IN_PROGRESS" : "CANCELLED"} /></td>
                    <td>{formatDate(p.effective_from)}</td>
                    <td><Link href={`/admin/configuracion/politicas/${p.policy_id}`} className="btn btn-secondary btn-sm">Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3"><Link href="/admin/configuracion/nueva-politica" className="btn btn-primary btn-sm">+ Nueva política</Link></p>
      </div>

      <div className="card mt-3">
        <h2>Plazos de cierre de operaciones</h2>
        <p className="text-secondary">Parámetros de negocio leídos por el dominio con fallback al valor por defecto. Cada cambio exige motivo y queda auditado.</p>
        <div className="table-wrap">
          <table>
            <caption>Parámetros operativos</caption>
            <thead>
              <tr><th>Parámetro</th><th>Valor actual</th><th>Última edición</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {Object.entries(SETTING_DEFS).map(([key, def]) => {
                const current = settingMap.get(key);
                const value = current ? JSON.parse(current.value_json) : undefined;
                return (
                  <tr key={key}>
                    <td>
                      <strong>{def.label}</strong>
                      <div className="text-secondary" style={{ fontSize: "var(--text-xs)" }}>{def.description}</div>
                    </td>
                    <td className="money">{value !== undefined ? `${value}${def.suffix ? ` ${def.suffix}` : ""}` : "default"}</td>
                    <td className="text-secondary" style={{ fontSize: "var(--text-xs)" }}>
                      {current ? `${current.updated_by ?? "system"} · ${formatDate(current.updated_at)}` : "sin cambios"}
                    </td>
                    <td>
                      <details>
                        <summary className="btn btn-secondary btn-sm" style={{ display: "inline-block" }}>Editar</summary>
                        <form action={updateSettingAction} className="flex-col mt-3" style={{ gap: 10, minWidth: 300 }}>
                          <input type="hidden" name="key" value={key} />
                          <input type="hidden" name="description" value={`${def.label}. ${def.description}`} />
                          <div className="field">
                            <label htmlFor={`val-${key}`}>Valor{def.suffix ? ` (${def.suffix})` : ""}</label>
                            <input id={`val-${key}`} name="value" type="number" min={1} required defaultValue={value} />
                          </div>
                          <div className="field">
                            <label htmlFor={`reason-${key}`}>Motivo (obligatorio)</label>
                            <input id={`reason-${key}`} name="reason" required placeholder="Motivo del cambio" />
                          </div>
                          <button className="btn btn-primary btn-sm" type="submit" style={{ alignSelf: "flex-start" }}>Guardar</button>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
