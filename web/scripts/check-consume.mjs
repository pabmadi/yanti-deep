/** E2E: consume el magic link vía POST a la server action y valida que crea sesión. */
const BASE = "http://localhost:3100";
const token = process.argv[2];

async function consume() {
  // 1) Obtener la página de continuar y extraer el action id de Next
  const pageRes = await fetch(`${BASE}/auth/continuar?token=${token}`);
  const html = await pageRes.text();
  const m = html.match(/name="next-action" value="([^"]+)"/) || html.match(/"actionId":"([^"]+)"/) || html.match(/action="([^"]+)"/);
  console.log("action match:", m ? m[1].slice(0, 60) : "none");

  // 2) POST multipart con el token (como haría el form)
  const form = new FormData();
  form.append("token", token);
  const postRes = await fetch(`${BASE}/auth/continuar`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
  console.log("POST /auth/continuar ->", postRes.status, "location:", postRes.headers.get("location"));
  const setCookie = postRes.headers.get("set-cookie") || "";
  console.log("set-cookie yanti_session:", setCookie.includes("yanti_session") ? "SI" : "NO");
}
consume();
