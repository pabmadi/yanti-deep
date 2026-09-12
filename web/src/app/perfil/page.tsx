import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { PreferenceControls } from "@/ui/components/PreferenceControls";
import { listRatingsForTarget } from "@/data/repos/rating-repo";
import { getDb } from "@/data/db";

export default async function PerfilPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;
  const ratings = listRatingsForTarget(getDb(), account.account_id);
  const average = ratings.length ? (ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length).toFixed(1) : "—";

  return (
    <AppShell account={account}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1>Perfil</h1>
        <dl className="dl card">
          <div><dt>Nombre</dt><dd>{account.display_name}</dd></div>
          <div><dt>Correo</dt><dd>{account.email_canonical}</dd></div>
          <div><dt>País</dt><dd>{account.country ?? "—"}</dd></div>
          <div><dt>Idioma</dt><dd>{account.locale}</dd></div>
          <div><dt>Zona horaria</dt><dd>{account.timezone}</dd></div>
        </dl>
        <p className="text-secondary mt-3" style={{ fontSize: "var(--text-sm)" }}>
          En el MVP local el perfil se crea automáticamente al ingresar con el magic link.
        </p>
        <section className="card mt-4" aria-labelledby="preferences-title">
          <h2 id="preferences-title">Preferencias</h2>
          <p className="text-secondary">Elegí el idioma de la interfaz y el modo de color para este dispositivo.</p>
          <PreferenceControls />
        </section>
        <section className="card mt-4" aria-labelledby="reputation-title">
          <div className="flex-between"><h2 id="reputation-title">Reputación</h2><a className="btn btn-secondary btn-sm" href={`/perfil/publico/${account.account_id}`}>Compartir perfil público</a></div>
          <p className="rating-summary"><strong>{average}</strong> <span aria-label={`${average} estrellas`}>★★★★★</span> · {ratings.length} calificaciones</p>
          {ratings.length === 0 ? <p className="text-secondary">Todavía no tenés calificaciones publicadas.</p> : <div className="flex-col">{ratings.map((rating) => <article className="evidence-thumb" key={rating.rating_id}><div className="flex-between"><span className="rating-stars" aria-label={`${rating.stars} estrellas`}>{"★".repeat(rating.stars)}{"☆".repeat(5-rating.stars)}</span><span className="text-secondary">{rating.role === "BUYER" ? "Como comprador" : "Como vendedor"}</span></div><p className="mt-2">{rating.comment}</p></article>)}</div>}
        </section>
      </div>
    </AppShell>
  );
}
