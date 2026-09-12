import { redirect } from "next/navigation";
import { currentSession } from "@/ui/lib/session";
import { AppShell } from "@/ui/components/AppShell";
import { PreferenceControls } from "@/ui/components/PreferenceControls";

export default async function PerfilPage() {
  const session = await currentSession();
  if (!session) redirect("/ingresar");
  const { account } = session;

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
      </div>
    </AppShell>
  );
}
