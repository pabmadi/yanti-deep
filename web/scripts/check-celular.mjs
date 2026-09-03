// Verificación E2E por IP local (celular): buzón + magic link + página de continuar.
const BASE = "http://192.168.100.34:3100";

async function main() {
  // 1) Buzón por IP
  const res = await fetch(`${BASE}/dev/buzon`);
  const html = await res.text();
  const m = html.match(/href="(http:\/\/192\.168\.100\.34:3100\/auth\/continuar\?token=[^"]+)"/);
  if (!m) {
    console.log("FAIL: no se encontró magic link con IP en el buzón");
    process.exit(1);
  }
  console.log("OK: buzón accesible por IP, magic link encontrado");

  // 2) Abrir el magic link (GET no consume, muestra botón)
  const contRes = await fetch(m[1], { redirect: "manual" });
  const contHtml = await contRes.text();
  const hasButton = contHtml.includes("Continuar");
  console.log(`${contRes.status === 200 && hasButton ? "OK" : "FAIL"}: GET magic link por IP -> ${contRes.status} (botón: ${hasButton})`);
  process.exit(contRes.status === 200 && hasButton ? 0 : 1);
}
main();
