/**
 * Genera magic links demo en la DB local (para el buzón).
 * La URL base se toma de YANTI_APP_URL o por defecto localhost.
 * Ejecutar: npx vitest run tests/gen-links.test.ts
 */
import { it } from "vitest";
import { getDb } from "@/data/db";
import { requestMagicLink } from "@/server/auth";

it("genera magic links para las cuentas demo", () => {
  const db = getDb();
  const base = process.env.YANTI_APP_URL ?? "http://localhost:3100";
  for (const email of ["ana@demo.yanti", "leo@demo.yanti", "ops@demo.yanti"]) {
    requestMagicLink(db, { email, returnPath: "/inicio", appBaseUrl: base });
  }
  const n = db.prepare("SELECT COUNT(*) AS c FROM email WHERE purpose='magic_link' AND created_at > datetime('now','-1 minute')").get() as { c: number };
  console.log(`Magic links generados recientemente (base=${base}): ${n.c}`);
});
