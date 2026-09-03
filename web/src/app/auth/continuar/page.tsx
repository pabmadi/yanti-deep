import type { Metadata } from "next";
import { consumeTokenAction } from "@/ui/actions/auth-actions";

export const metadata: Metadata = { title: "Continuar — Yanti" };

/**
 * GET muestra una pantalla de continuación y NO consume el token (RF-AUT-006,
 * CA-AUT-004): previsualizadores/scanners no lo invalidan. El consumo exige POST.
 */
export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  if (!token) {
    return (
      <div className="page-wrap" style={{ maxWidth: 440, margin: "0 auto", paddingTop: 48 }}>
        <div className="card">
          <h1>Enlace inválido</h1>
          <p className="text-secondary">Este enlace no es válido. Pedí uno nuevo.</p>
          <a className="btn btn-primary" href="/ingresar">
            Ir a ingresar
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="page-wrap" style={{ maxWidth: 440, margin: "0 auto", paddingTop: 48 }}>
      <div className="card">
        <h1>¿Continuar a Yanti?</h1>
        <p className="text-secondary">
          Vas a iniciar sesión en la app. Al continuar se creará tu sesión de forma segura.
        </p>
        <form action={consumeTokenAction} className="mt-3">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-primary btn-block">
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
}
