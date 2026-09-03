import type { Metadata } from "next";
import { requestLoginAction, demoLoginAction } from "@/ui/actions/auth-actions";

export const metadata: Metadata = { title: "Ingresar — Yanti" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; email?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="page-wrap" style={{ maxWidth: 460, margin: "0 auto", paddingTop: 40 }}>
      <h1>Ingresar a Yanti</h1>
      <p className="text-secondary">
        Compraventa protegida entre particulares. Te enviamos un enlace mágico a tu correo.
      </p>

      {sp.enviado === "1" && (
        <div className="banner banner-success" role="status">
          Revisá tu correo ({sp.email ?? "tu correo"}). En esta demo, el enlace aparece en el{" "}
          <a href="/dev/buzon">buzón local</a>.
        </div>
      )}
      {sp.error === "1" && (
        <div className="banner banner-danger" role="alert">
          El enlace no es válido o ya fue usado. Pedí uno nuevo.
        </div>
      )}

      <div className="card">
        <form action={requestLoginAction} className="flex-col">
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="tucorreo@ejemplo.com" />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Enviarme el enlace
          </button>
        </form>
      </div>

      <div className="card mt-4">
        <h2>Acceso rápido a la demo</h2>
        <p className="text-secondary">Elegí una identidad: se genera el enlace y te lleva al buzón local para abrirlo.</p>
        <form action={demoLoginAction} className="flex-col mt-2">
          <button name="cuenta" value="seller" className="btn btn-secondary btn-block" type="submit">
            Entrar como Ana (vendedora)
          </button>
          <button name="cuenta" value="buyer" className="btn btn-secondary btn-block" type="submit">
            Entrar como Leo (comprador)
          </button>
          <button name="cuenta" value="ops" className="btn btn-accent btn-block" type="submit">
            Entrar como Operaciones (admin)
          </button>
        </form>
      </div>
    </div>
  );
}
