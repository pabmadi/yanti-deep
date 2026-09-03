import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { createDraftAction } from "@/ui/actions/operation-actions";

export default async function NuevaSolicitudPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;

  return (
    <AppShell account={account}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1>Nueva solicitud de pago</h1>
        <p className="text-secondary">
          Creá una solicitud protegida: el comprador revisa el acuerdo, paga y el dinero queda
          sujeto hasta que confirmes el envío y él confirme la recepción.
        </p>

        <form action={createDraftAction} className="card flex-col">
          <div className="field">
            <label htmlFor="titulo">Qué vendés *</label>
            <input id="titulo" name="titulo" required placeholder="Ej: Cámara Fuji X-T30 con lente 18-55mm" />
          </div>
          <div className="field">
            <label htmlFor="descripcion">Condición y detalles *</label>
            <textarea
              id="descripcion"
              name="descripcion"
              required
              placeholder="Marca, modelo, estado, defectos conocidos, accesorios incluidos…"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="monto">Precio (ARS) *</label>
              <input id="monto" name="monto" type="number" inputMode="decimal" min="1" step="1" required placeholder="45000" />
            </div>
            <div className="field">
              <label htmlFor="categoria">Categoría *</label>
              <select id="categoria" name="categoria">
                <option value="GENERAL">General</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="comprador_email">Correo del comprador *</label>
            <input id="comprador_email" name="comprador_email" type="email" required placeholder="comprador@ejemplo.com" />
            <p className="hint">Le llega una invitación para revisar y pagar.</p>
          </div>
          <div className="field">
            <label htmlFor="enlace">Enlace a la publicación (opcional)</label>
            <input id="enlace" name="enlace" type="url" placeholder="https://…" />
          </div>
          <input type="hidden" name="pais" value="AR" />
          <input type="hidden" name="moneda" value="ARS" />
          <button type="submit" className="btn btn-primary btn-block">
            Crear solicitud
          </button>
        </form>
      </div>
    </AppShell>
  );
}
