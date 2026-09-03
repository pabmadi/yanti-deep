/** Verificación HTTP final de la DEMO-1 contra la DB sembrada. */
const BASE = "http://localhost:3100";
const ANA = "mqVKqcKTkm4ASNAwqMZ4qoYawKa5mDvzbkLyiz6y7Kc";
const OPS = "I0iZn1BptCTZDCwRn9-9ESwIBo5MUbFFrfZ_xfG7Z4U";

const OPS_DEMO = [
  ["op_VZFN3fr_l7W-", "COMPLETED", "Fuji"],
  ["op_DXCZ1p6x3HLc", "REFUNDED", "Parlante"],
  ["op_VxFGdD_dXu-w", "SHIPPED", "Teclado"],
];
const DISPUTE = "dsp_Ci0cErbRvGpM";

async function get(path, cookie) {
  const res = await fetch(BASE + path, {
    headers: cookie ? { Cookie: `yanti_session=${cookie}` } : {},
    redirect: "manual",
  });
  const body = await res.text();
  return { status: res.status, body };
}

const results = [];
const push = (name, cond, status) => results.push([name, cond, status]);

let r = await get("/ingresar");
push("Pública /ingresar", r.status === 200 && r.body.includes("Ingresar a Yanti"), r.status);
r = await get("/dev/buzon");
push("Buzón local (con magic links)", r.status === 200 && r.body.includes("Buzón local"), r.status);
r = await get("/inicio");
push("Middleware: /inicio sin sesión redirige", r.status === 307 || r.status === 302, r.status);

// Ana (vendedora)
r = await get("/inicio", ANA);
push("Ana ve su dashboard", r.status === 200 && r.body.includes("Ana"), r.status);
r = await get("/mis-ventas", ANA);
push("Ana ve sus ventas", r.status === 200 && r.body.includes("ventas"), r.status);
for (const [opId, state, label] of OPS_DEMO) {
  r = await get(`/operaciones/${opId}`, ANA);
  push(`Detalle ${state} (${label})`, r.status === 200 && r.body.includes(label), r.status);
}
r = await get(`/disputas/${DISPUTE}`, ANA);
push("Disputa con evidencia", r.status === 200 && r.body.includes("Reclamo"), r.status);
r = await get("/admin", ANA);
push("Ana NO accede a admin", r.status === 307 || r.status === 302, r.status);

// Ops (admin)
r = await get("/admin", OPS);
push("Admin ve consola", r.status === 200 && r.body.includes("Consola de operaciones"), r.status);
r = await get(`/admin/operaciones/${OPS_DEMO[1][0]}`, OPS);
push("Admin detalle con ledger", r.status === 200 && r.body.includes("Ledger"), r.status);
r = await get("/admin/auditoria", OPS);
push("Admin auditoría", r.status === 200 && r.body.includes("Auditoría"), r.status);

let allOk = true;
for (const [name, ok, status] of results) {
  if (!ok) allOk = false;
  console.log(`${ok ? "OK " : "FAIL"} [${String(status).padEnd(3)}] ${name}`);
}
console.log(allOk ? "\nTODAS LAS COMPROBACIONES OK" : "\nHAY FALLOS");
process.exit(allOk ? 0 : 1);
