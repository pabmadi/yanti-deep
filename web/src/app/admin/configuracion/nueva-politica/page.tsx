import { redirect } from "next/navigation";
import { currentAdmin } from "@/ui/lib/session";
import { getDb } from "@/data/db";
import { listEnabledCountries, listEnabledCategories } from "@/data/repos/catalog-repo";
import { createPolicyAction } from "@/ui/actions/admin-policy-actions";

export default async function NuevaPoliticaPage() {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const db = getDb();
  const countries = listEnabledCountries(db);
  const categories = listEnabledCategories(db);

  return (
    <>
      <h1>Nueva política de comisión</h1>
      <p className="text-secondary"><a href="/admin/configuracion">← Volver a configuración</a></p>
      <p className="text-secondary">Se crea como borrador (versión siguiente del ámbito). Validá y publicá desde el detalle; nunca es retroactiva.</p>

      <form action={createPolicyAction} className="card flex-col mt-3" style={{ gap: 12, maxWidth: 560 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="countryCode">País</label>
            <select id="countryCode" name="countryCode" required>
              {countries.map((c) => <option key={c.country_code} value={c.country_code}>{c.country_code} · {c.name_es}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="currency">Moneda</label>
            <input id="currency" name="currency" required placeholder="ARS" pattern="[A-Za-z]{3}" />
          </div>
          <div className="field">
            <label htmlFor="categoryCode">Categoría</label>
            <select id="categoryCode" name="categoryCode" required>
              {categories.map((c) => <option key={c.category_code} value={c.category_code}>{c.category_code} · {c.label_es}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="buyerRatePct">Comisión comprador (%)</label>
            <input id="buyerRatePct" name="buyerRatePct" type="number" min={0} max={100} step="0.01" defaultValue={1} required />
          </div>
          <div className="field">
            <label htmlFor="sellerRatePct">Comisión vendedor (%)</label>
            <input id="sellerRatePct" name="sellerRatePct" type="number" min={0} max={100} step="0.01" defaultValue={1} required />
          </div>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="buyerFixedMinor">Fijo comprador (unidades menores, opcional)</label>
            <input id="buyerFixedMinor" name="buyerFixedMinor" type="number" min={0} placeholder="0" />
          </div>
          <div className="field">
            <label htmlFor="sellerFixedMinor">Fijo vendedor (unidades menores, opcional)</label>
            <input id="sellerFixedMinor" name="sellerFixedMinor" type="number" min={0} placeholder="0" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="reason">Motivo (obligatorio)</label>
          <textarea id="reason" name="reason" rows={2} required placeholder="Motivo estructurado del cambio de política"></textarea>
        </div>
        <button className="btn btn-primary btn-block" type="submit">Crear borrador</button>
      </form>
    </>
  );
}
