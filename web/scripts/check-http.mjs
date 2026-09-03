/** Verificación HTTP autenticada de las páginas de la DEMO-1. Uso: node check-http.mjs */
const BASE = "http://localhost:3100";
const TOKEN = process.env.TOKEN || "LMDYJ2s2Afqv5Nw6pEkLlxudE5C4JGRIu80Hh-eQTdA"; // ana (vendedora)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "jasyPEGHuGfcJCIDUm7m_oZbkHimPKM42EpdkPrnKEI"; // ops (admin)

async function get(path, cookie) {
  const res = await fetch(BASE + path, {
    headers: cookie ? { Cookie: `yanti_session=${cookie}` } : {},
    redirect: "manual",
  });
  const body = await res.text();
  return { status: res.status, location: res.headers.get("location"), body };
}

const results = [];
// Públicas
let r = await get("/ingresar");
results.push(["GET /ingresar", r.status, r.body.includes("Ingresar a Yanti") ? "OK" : "MISSING"]);

r = await get("/dev/buzon");
results.push(["GET /dev/buzon", r.status, r.body.includes("Buzón local") ? "OK" : "MISSING"]);

// Sin sesión -> debe redirigir
r = await get("/inicio");
results.push(["GET /inicio sin sesión", r.status, r.status === 307 || r.status === 302 ? "REDIRECT_OK" : "NO_REDIRECT"]);

// Con sesión
r = await get("/inicio", TOKEN);
results.push(["GET /inicio con sesión", r.status, r.body.includes("Ana") ? "OK" : "MISSING"]);

r = await get("/mis-ventas", TOKEN);
results.push(["GET /mis-ventas", r.status, r.body.includes("Cámara") || r.body.includes("Parlante") || r.body.includes("ventas") ? "OK" : "MISSING"]);

// Detalle de operación demo COMPLETED
r = await get("/operaciones/op_juEwYdu-iin9", TOKEN);
results.push(["GET detalle operación (COMPLETED)", r.status, r.body.includes("Fuji") ? "OK" : "MISSING"]);

r = await get("/operaciones/op_N2fvJlLdR8yA", TOKEN);
results.push(["GET detalle operación (REFUNDED)", r.status, r.body.includes("Parlante") ? "OK" : "MISSING"]);

// Disputa resuelta (evidencia bilateral)
r = await get("/disputas/dsp_tLbUS2jod2u3", TOKEN);
results.push(["GET disputa resuelta", r.status, r.body.includes("Reclamo") ? "OK" : "MISSING"]);

// Admin requiere admin; ana no es admin -> debe redirigir
r = await get("/admin", TOKEN);
results.push(["GET /admin como no-admin", r.status, (r.status === 307 || r.status === 302) ? "DENY_OK" : "NO_DENY"]);

// Admin: ops es admin, debe ver la consola con la disputa resuelta y pagos
r = await get("/admin", ADMIN_TOKEN);
results.push(["GET /admin como admin", r.status, r.body.includes("Consola de operaciones") ? "OK" : "MISSING"]);

r = await get("/admin/operaciones/op_N2fvJlLdR8yA", ADMIN_TOKEN);
results.push(["GET admin detalle (REFUNDED)", r.status, r.body.includes("Parlante") ? "OK" : "MISSING"]);

r = await get("/admin/auditoria", ADMIN_TOKEN);
results.push(["GET admin auditoría", r.status, r.body.includes("Auditoría") ? "OK" : "MISSING"]);

for (const [name, status, check] of results) {
  console.log(`${check.padEnd(14)} ${String(status).padEnd(4)} ${name}`);
}
