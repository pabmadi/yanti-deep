import { redirect } from "next/navigation";
import { currentAdmin } from "@/ui/lib/session";
import { getDb } from "@/data/db";
import { listCategoriesAdmin, listCountriesAdmin } from "@/server/admin-queries";
import { saveCategoryAction, saveCountryAction } from "@/ui/actions/admin-catalog-actions";
import { StatusBadge } from "@/ui/components/StatusBadge";

export default async function AdminCatalogosPage({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const account = await currentAdmin();
  if (!account) redirect("/ingresar");
  const db = getDb();
  const sp = await searchParams;

  const categories = listCategoriesAdmin(db);
  const countries = listCountriesAdmin(db);

  return (
    <>
      <h1>Catálogos</h1>
      <p className="text-secondary">Administrar categorías y países habilitados. Cambiar el estado o las monedas de un ámbito con operaciones activas está protegido.</p>
      {sp.guardado && <div className="banner banner-success">Catálogo actualizado.</div>}

      <div className="card mt-3">
        <h2>Categorías</h2>
        <div className="table-wrap">
          <table>
            <caption>Catálogo de categorías</caption>
            <thead>
              <tr><th>Código</th><th>Etiqueta ES</th><th>Etiqueta PT</th><th>Habilitada</th></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.category_code}>
                  <td>{c.category_code}</td>
                  <td>{c.label_es}</td>
                  <td>{c.label_pt ?? "—"}</td>
                  <td>{c.enabled ? <StatusBadge state="COMPLETED" /> : <StatusBadge state="CANCELLED" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="mt-3">
          <summary className="btn btn-secondary btn-sm" style={{ display: "inline-block" }}>+ Nueva categoría</summary>
          <form action={saveCategoryAction} className="flex-col mt-3" style={{ gap: 12, maxWidth: 480 }}>
            <input type="hidden" name="enabled" value="1" />
            <div className="field">
              <label htmlFor="cat-code">Código (mayúsculas, p.ej. ELECTRONICA)</label>
              <input id="cat-code" name="code" required pattern="[A-Za-z][A-Za-z0-9_]{1,19}" placeholder="ELECTRONICA" />
            </div>
            <div className="field">
              <label htmlFor="cat-label-es">Nombre (ES)</label>
              <input id="cat-label-es" name="labelEs" required placeholder="Electrónica" />
            </div>
            <div className="field">
              <label htmlFor="cat-label-pt">Nombre (PT)</label>
              <input id="cat-label-pt" name="labelPt" placeholder="Eletrônicos" />
            </div>
            <div className="field">
              <label htmlFor="cat-reason">Motivo (obligatorio)</label>
              <input id="cat-reason" name="reason" required placeholder="Motivo del alta" />
            </div>
            <button className="btn btn-primary btn-sm" type="submit" style={{ alignSelf: "flex-start" }}>Guardar categoría</button>
          </form>
        </details>
      </div>

      <div className="card mt-3">
        <h2>Países</h2>
        <div className="table-wrap">
          <table>
            <caption>Catálogo de países operativos</caption>
            <thead>
              <tr><th>Código</th><th>Nombre ES</th><th>Monedas</th><th>Habilitado</th></tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.country_code}>
                  <td>{c.country_code}</td>
                  <td>{c.name_es}</td>
                  <td>{JSON.parse(c.currency_codes).join(", ")}</td>
                  <td>{c.enabled ? <StatusBadge state="COMPLETED" /> : <StatusBadge state="CANCELLED" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="mt-3">
          <summary className="btn btn-secondary btn-sm" style={{ display: "inline-block" }}>+ Nuevo país</summary>
          <form action={saveCountryAction} className="flex-col mt-3" style={{ gap: 12, maxWidth: 480 }}>
            <input type="hidden" name="enabled" value="1" />
            <div className="field">
              <label htmlFor="co-code">Código (ISO 3166-1 alpha-2)</label>
              <input id="co-code" name="code" required pattern="[A-Za-z]{2}" placeholder="MX" />
            </div>
            <div className="field">
              <label htmlFor="co-name-es">Nombre (ES)</label>
              <input id="co-name-es" name="nameEs" required placeholder="México" />
            </div>
            <div className="field">
              <label htmlFor="co-name-pt">Nombre (PT)</label>
              <input id="co-name-pt" name="namePt" placeholder="México" />
            </div>
            <div className="field">
              <label htmlFor="co-currencies">Monedas (ISO 4217, separadas por coma)</label>
              <input id="co-currencies" name="currencyCodes" required placeholder="MXN" />
            </div>
            <div className="field">
              <label htmlFor="co-reason">Motivo (obligatorio)</label>
              <input id="co-reason" name="reason" required placeholder="Motivo del alta" />
            </div>
            <button className="btn btn-primary btn-sm" type="submit" style={{ alignSelf: "flex-start" }}>Guardar país</button>
          </form>
        </details>
      </div>
    </>
  );
}
