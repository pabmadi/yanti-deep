/** Limpia magic links previos y genera nuevos con la URL correcta. npx vitest run tests/fix-links.test.ts */
import { it } from "vitest";
import { getDb } from "@/data/db";
import { requestMagicLink } from "@/server/auth";

it("reemplaza magic links del buzón con URL correcta", () => {
  const db = getDb();
  // Quitar tokens sin consumir (los consumidos se conservan como historial)
  db.prepare("DELETE FROM magic_link_token WHERE consumed_at IS NULL").run();
  // También limpiar emails de magic link viejos para no confundir
  db.prepare("DELETE FROM email WHERE purpose='magic_link'").run();

  for (const email of ["ana@demo.yanti", "leo@demo.yanti", "ops@demo.yanti"]) {
    requestMagicLink(db, { email, returnPath: "/inicio", appBaseUrl: "http://localhost:3100" });
  }
  const rows = db.prepare("SELECT body_text FROM email WHERE purpose='magic_link'").all() as Array<{ body_text: string }>;
  for (const r of rows) {
    console.log("LINK:", r.body_text.match(/https?:\/\/\S+/)?.[0] ?? "sin url");
  }
});
