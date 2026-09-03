import type { DatabaseSync } from "node:sqlite";
import { asRows, asRow } from "../db";

export interface CountryRow {
  country_code: string;
  name_es: string;
  name_pt: string | null;
  currency_codes: string;
  enabled: number;
}

export interface CategoryRow {
  category_code: string;
  label_es: string;
  label_pt: string | null;
  enabled: number;
}

export function listEnabledCountries(db: DatabaseSync): CountryRow[] {
  return asRows<CountryRow>(db.prepare("SELECT * FROM country_catalog WHERE enabled=1 ORDER BY name_es").all());
}

export function listEnabledCategories(db: DatabaseSync): CategoryRow[] {
  return asRows<CategoryRow>(db.prepare("SELECT * FROM category_catalog WHERE enabled=1 ORDER BY label_es").all());
}

export function getCountry(db: DatabaseSync, code: string): CountryRow | undefined {
  return asRow<CountryRow | undefined>(db.prepare("SELECT * FROM country_catalog WHERE country_code=?").get(code));
}

export function getCategory(db: DatabaseSync, code: string): CategoryRow | undefined {
  return asRow<CategoryRow | undefined>(db.prepare("SELECT * FROM category_catalog WHERE category_code=?").get(code));
}

export function listAllCountries(db: DatabaseSync): CountryRow[] {
  return asRows<CountryRow>(db.prepare("SELECT * FROM country_catalog ORDER BY name_es").all());
}

export function listAllCategories(db: DatabaseSync): CategoryRow[] {
  return asRows<CategoryRow>(db.prepare("SELECT * FROM category_catalog ORDER BY label_es").all());
}

export function upsertCountry(
  db: DatabaseSync,
  c: { code: string; nameEs: string; namePt?: string | null; currencyCodes: string[]; enabled: boolean },
): void {
  db.prepare(
    `INSERT INTO country_catalog (country_code, name_es, name_pt, currency_codes, enabled)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(country_code) DO UPDATE SET
       name_es=excluded.name_es, name_pt=excluded.name_pt,
       currency_codes=excluded.currency_codes, enabled=excluded.enabled`,
  ).run(c.code.toUpperCase(), c.nameEs.trim(), c.namePt?.trim() || null, JSON.stringify(c.currencyCodes), c.enabled ? 1 : 0);
}

export function upsertCategory(
  db: DatabaseSync,
  c: { code: string; labelEs: string; labelPt?: string | null; enabled: boolean },
): void {
  db.prepare(
    `INSERT INTO category_catalog (category_code, label_es, label_pt, enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(category_code) DO UPDATE SET
       label_es=excluded.label_es, label_pt=excluded.label_pt, enabled=excluded.enabled`,
  ).run(c.code.toUpperCase(), c.labelEs.trim(), c.labelPt?.trim() || null, c.enabled ? 1 : 0);
}
