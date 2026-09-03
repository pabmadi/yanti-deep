/**
 * Administración de catálogos (categorías y países) por el admin de sistema.
 * Guardas: no se puede deshabilitar un ámbito con operaciones activas ni con
 * políticas activas (evita romper elegibilidad); todo cambio audita.
 */
import type { DatabaseSync } from "node:sqlite";
import { getAccount, type AccountRow } from "@/data/repos/account-repo";
import { getCountry, getCategory } from "@/data/repos/catalog-repo";
import { recordAudit } from "@/data/infra";
import { errAuth, errValidation } from "@/domain/errors";

function requireAdmin(db: DatabaseSync, accountId: string): AccountRow {
  const acc = getAccount(db, accountId);
  if (!acc || !acc.is_admin) throw errAuth();
  return acc;
}

const CURRENCY_RE = /^[A-Z]{3}$/;

export function saveCountry(
  db: DatabaseSync,
  input: {
    adminId: string;
    code: string;
    nameEs: string;
    namePt?: string | null;
    currencyCodes: string[];
    enabled: boolean;
    reason: string;
  },
): void {
  const admin = requireAdmin(db, input.adminId);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw errValidation("El código de país debe tener 2 letras");
  if (!input.nameEs.trim()) throw errValidation("El nombre es obligatorio");
  if (!input.currencyCodes.length || input.currencyCodes.some((c) => !CURRENCY_RE.test(c))) {
    throw errValidation("Indicá al menos una moneda válida (ISO 4217)");
  }
  const cur = getCountry(db, code);
  if (cur && !cur.enabled && input.enabled) {
    // re-habilitar sin más
  }
  if (cur && !input.enabled) {
    assertCountryDisablable(db, code);
  }
  // Guardas de operación existente: si cambia monedas y hay operaciones, validar que la moneda siga cubierta.
  if (cur) {
    const activeOps = db
      .prepare("SELECT COUNT(*) AS c FROM operation WHERE country_code=? AND state NOT IN ('COMPLETED','REFUNDED','CANCELLED','EXPIRED')")
      .get(code) as { c: number };
    if (activeOps.c > 0) {
      const existingCurrencies = JSON.parse(cur.currency_codes) as string[];
      const missing = existingCurrencies.filter((c) => !input.currencyCodes.includes(c));
      if (missing.length > 0) {
        throw errValidation(`No se pueden quitar monedas (${missing.join(", ")}) con operaciones activas en ${code}`);
      }
    }
  }
  const before = cur;
  db.prepare(
    `INSERT INTO country_catalog (country_code, name_es, name_pt, currency_codes, enabled)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(country_code) DO UPDATE SET
       name_es=excluded.name_es, name_pt=excluded.name_pt,
       currency_codes=excluded.currency_codes, enabled=excluded.enabled`,
  ).run(code, input.nameEs.trim(), input.namePt?.trim() || null, JSON.stringify([...new Set(input.currencyCodes)]), input.enabled ? 1 : 0);
  recordAudit(db, {
    actorId: input.adminId,
    roleEffective: "ADMIN",
    action: "catalog.country.save",
    resourceType: "country_catalog",
    resourceId: code,
    reason: input.reason,
    before: before ? { name: before.name_es, currencies: JSON.parse(before.currency_codes), enabled: before.enabled } : undefined,
    after: { name: input.nameEs, currencies: input.currencyCodes, enabled: input.enabled },
  });
}

function assertCountryDisablable(db: DatabaseSync, code: string): void {
  const activeOps = db
    .prepare("SELECT COUNT(*) AS c FROM operation WHERE country_code=? AND state NOT IN ('COMPLETED','REFUNDED','CANCELLED','EXPIRED')")
    .get(code) as { c: number };
  if (activeOps.c > 0) throw errValidation(`No se puede deshabilitar ${code}: hay operaciones activas`);
  const activePolicies = db
    .prepare("SELECT COUNT(*) AS c FROM fee_policy_version WHERE country_code=? AND status='ACTIVE'")
    .get(code) as { c: number };
  if (activePolicies.c > 0) throw errValidation(`No se puede deshabilitar ${code}: hay políticas de comisión activas`);
}

export function saveCategory(
  db: DatabaseSync,
  input: {
    adminId: string;
    code: string;
    labelEs: string;
    labelPt?: string | null;
    enabled: boolean;
    reason: string;
  },
): void {
  const admin = requireAdmin(db, input.adminId);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(code)) throw errValidation("Código de categoría inválido (mayúsculas, números y _)");
  if (!input.labelEs.trim()) throw errValidation("El nombre es obligatorio");
  const cur = getCategory(db, code);
  if (cur && !input.enabled) {
    const activeOps = db
      .prepare("SELECT COUNT(*) AS c FROM operation WHERE category_code=? AND state NOT IN ('COMPLETED','REFUNDED','CANCELLED','EXPIRED')")
      .get(code) as { c: number };
    if (activeOps.c > 0) throw errValidation(`No se puede deshabilitar ${code}: hay operaciones activas`);
    const activePolicies = db
      .prepare("SELECT COUNT(*) AS c FROM fee_policy_version WHERE category_code=? AND status='ACTIVE'")
      .get(code) as { c: number };
    if (activePolicies.c > 0) throw errValidation(`No se puede deshabilitar ${code}: hay políticas de comisión activas`);
  }
  const before = cur;
  db.prepare(
    `INSERT INTO category_catalog (category_code, label_es, label_pt, enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(category_code) DO UPDATE SET
       label_es=excluded.label_es, label_pt=excluded.label_pt, enabled=excluded.enabled`,
  ).run(code, input.labelEs.trim(), input.labelPt?.trim() || null, input.enabled ? 1 : 0);
  recordAudit(db, {
    actorId: input.adminId,
    roleEffective: "ADMIN",
    action: "catalog.category.save",
    resourceType: "category_catalog",
    resourceId: code,
    reason: input.reason,
    before: before ? { label: before.label_es, enabled: before.enabled } : undefined,
    after: { label: input.labelEs, enabled: input.enabled },
  });
}
