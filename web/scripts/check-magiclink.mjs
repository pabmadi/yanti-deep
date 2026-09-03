/** Verifica el flujo del magic link por HTTP (GET no consume; página continúa OK). */
const BASE = "http://localhost:3100";
const token = process.argv[2];

async function check() {
  // GET a la página de continuar: NO debe consumir el token (200, no redirección)
  const res = await fetch(`${BASE}/auth/continuar?token=${token}`, { redirect: "manual" });
  const body = await res.text();
  console.log(`GET /auth/continuar -> ${res.status} | contiene boton: ${body.includes("Continuar")}`);

  // El token sigue válido (no consumido por GET)
  const dbRes = await fetch(`${BASE}/ingresar`);
  console.log(`GET /ingresar -> ${dbRes.status}`);
}
check();
