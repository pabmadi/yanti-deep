/** E2E real del magic link: GET (no consume) + POST de consumo vía server action. */
const BASE = "http://localhost:3100";
const token = process.argv[2];

async function main() {
  // 1) GET de la página de continuar
  const pageRes = await fetch(`${BASE}/auth/continuar?token=${token}`, { redirect: "manual" });
  const html = await pageRes.text();
  console.log(`GET /auth/continuar -> ${pageRes.status} | botón Continuar presente: ${html.includes("Continuar")}`);

  // 2) Buscar el action id que Next embebe (para POST real de server action)
  //    En el HTML SSR el id viaja en el self.__next_f stream como actionId.
  const actionMatches = [...html.matchAll(/\["actionId","([^"]+)"/g)].map((m) => m[1]);
  console.log(`actionIds encontrados: ${actionMatches.length}`);

  if (actionMatches.length > 0) {
    const actionId = actionMatches[actionMatches.length - 1];
    const body = new URLSearchParams();
    body.set("1_token", token);
    body.set("0", JSON.stringify([token]));

    const postRes = await fetch(`${BASE}/auth/continuar`, {
      method: "POST",
      headers: {
        "Next-Action": actionId,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify([token]),
      redirect: "manual",
    });
    console.log(`POST server action -> ${postRes.status}`);
    const setCookie = postRes.headers.get("set-cookie") || "";
    console.log(`set-cookie yanti_session: ${setCookie.includes("yanti_session") ? "SÍ" : "no"}`);
    const loc = postRes.headers.get("x-action-redirect") || postRes.headers.get("location");
    if (loc) console.log(`redirect: ${loc}`);
  }
}
main();
