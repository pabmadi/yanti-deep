/** Verifica los magic links del buzón en paralelo con timeout corto por link. */
const BASE = "http://localhost:3100";

async function main() {
  const res = await fetch(`${BASE}/dev/buzon`);
  const html = await res.text();
  const links = [...html.matchAll(/href="(http:\/\/localhost:3100\/auth\/continuar\?token=[^"]+)"/g)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  console.log(`Magic links en buzón: ${links.length}`);
  const results = await Promise.all(
    links.map(async (link) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const r = await fetch(link, { redirect: "manual", signal: controller.signal });
        const body = await r.text();
        const good = r.status === 200 && body.includes("Continuar");
        return { link, status: r.status, good };
      } catch (e) {
        return { link, status: "ERR", good: false };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  let ok = 0;
  for (const { link, status, good } of results) {
    if (good) ok++;
    console.log(`${good ? "OK " : "FAIL"} [${status}] ${link.slice(0, 70)}...`);
  }
  console.log(`\n${ok}/${links.length} enlaces OK`);
  process.exit(ok === links.length && links.length > 0 ? 0 : 1);
}
main();
