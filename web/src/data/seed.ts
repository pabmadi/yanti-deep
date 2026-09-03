/**
 * Datos sintéticos para DEMO-1 (R00-R02, etiquetados de prueba; nunca productivos).
 * - Cuentas: vendedora (ana), comprador (leo), admin local de prueba.
 * - Catálogo: país AR con moneda ARS; categoría GENERAL.
 * - Fee policy activa de prueba: 1% comprador, 1% vendedor.
 */
import type { DatabaseSync } from "node:sqlite";
import { id } from "./ids.ts";

export const DEMO = {
  SELLER_EMAIL: "ana@demo.yanti",
  BUYER_EMAIL: "leo@demo.yanti",
  ADMIN_EMAIL: "ops@demo.yanti",
};

export function ensureCatalog(db: DatabaseSync): void {
  db.prepare(
    `INSERT OR IGNORE INTO country_catalog (country_code, name_es, name_pt, currency_codes, enabled) VALUES ('AR', 'Argentina', 'Argentina', '["ARS"]', 1)`,
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO country_catalog (country_code, name_es, name_pt, currency_codes, enabled) VALUES ('BR', 'Brasil', 'Brasil', '["BRL"]', 1)`,
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO category_catalog (category_code, label_es, label_pt, enabled) VALUES ('GENERAL', 'General', 'Geral', 1)`,
  ).run();
}

export function ensureFeePolicyTest(db: DatabaseSync): void {
  const exists = db.prepare("SELECT COUNT(*) AS c FROM fee_policy_version WHERE policy_id='pol_test_ar_ars'").get() as { c: number };
  if (exists.c > 0) return;
  db.prepare(
    `INSERT INTO fee_policy_version
     (policy_id, country_code, currency, category_code, status, version, buyer_rate_num, buyer_rate_den, buyer_fixed_minor, seller_rate_num, seller_rate_den, seller_fixed_minor, effective_from, created_at, reason)
     VALUES ('pol_test_ar_ars', 'AR', 'ARS', 'GENERAL', 'ACTIVE', 1, 100, 10000, 0, 100, 10000, 0, '2000-01-01T00:00:00.000Z', ?, 'Política de prueba local; NO productiva (1% + 1%)')`,
  ).run(new Date().toISOString());
}

export function ensureAccounts(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const accounts = [
    { email: DEMO.SELLER_EMAIL, name: "Ana (vendedora)", admin: 0 },
    { email: DEMO.BUYER_EMAIL, name: "Leo (comprador)", admin: 0 },
    { email: DEMO.ADMIN_EMAIL, name: "Operaciones Yanti", admin: 1 },
  ];
  for (const a of accounts) {
    const exists = db.prepare("SELECT account_id FROM account WHERE email_canonical=?").get(a.email) as { account_id: string } | undefined;
    if (exists) continue;
    db.prepare(
      `INSERT INTO account (account_id, display_name, email_canonical, locale, country, timezone, status, is_admin, created_at, updated_at, version)
       VALUES (?, ?, ?, 'es', 'AR', 'America/Argentina/Buenos_Aires', 'ACTIVE', ?, ?, ?, 1)`,
    ).run(id("acc"), a.name, a.email, a.admin, now, now);
  }
}

export function ensureSeed(db: DatabaseSync): void {
  ensureCatalog(db);
  ensureFeePolicyTest(db);
  ensureAccounts(db);
}
