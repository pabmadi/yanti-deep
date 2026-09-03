/**
 * Pruebas del panel admin: configuración (settings con fallback), métricas sobre
 * el ledger, gestión de usuarios, catálogos y políticas de comisión.
 * Usa DB temporal aislada (como flow.test.ts).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const tmpDir = mkdtempSync(join(tmpdir(), "yanti-admin-test-"));
process.env.YANTI_DB_PATH = join(tmpDir, "admin.db");

import { getDb, resetDb } from "@/data/db";
import { ensureSeed, DEMO } from "@/data/seed";
import { accountIdByEmail, seedHistory } from "@/data/seed-demo";
import { getSettingNumber, upsertSetting, listSettings } from "@/data/repos/setting-repo";
import { getAdminKpis, getRevenueSeries, getOpsByState, getRevenueByCountryCurrency } from "@/server/admin-metrics";
import { setAccountStatus } from "@/server/admin-users";
import { getUserDetail, listUsers } from "@/server/admin-queries";
import { saveCategory, saveCountry } from "@/server/admin-catalog";
import { createPolicyDraft, validatePolicy, publishPolicy, retirePolicy, simulatePolicy } from "@/server/admin-policy";
import { createOperationDraft, sendOperation } from "@/server/operations";
import { getFrozenPolicy } from "@/server/policy";

describe("Panel admin", () => {
  let db: ReturnType<typeof getDb>;
  let adminId: string;
  let buyerId: string;
  let sellerId: string;

  beforeAll(() => {
    db = getDb();
    resetDb(db);
    ensureSeed(db);
    adminId = accountIdByEmail(db, DEMO.ADMIN_EMAIL);
    buyerId = accountIdByEmail(db, DEMO.BUYER_EMAIL);
    sellerId = accountIdByEmail(db, DEMO.SELLER_EMAIL);
  });

  it("settings: lectura con fallback y upsert con auditoría", () => {
    expect(getSettingNumber(db, "delivery_days", 10)).toBe(10); // fallback
    upsertSetting(db, { key: "delivery_days", value: 15, description: "Días de entrega", updatedBy: adminId, reason: "Ajuste de prueba" });
    expect(getSettingNumber(db, "delivery_days", 10)).toBe(15);
    expect(listSettings(db).some((s) => s.setting_key === "delivery_days")).toBe(true);
    const audit = db.prepare("SELECT * FROM audit_record WHERE action='setting.update' AND resource_id='delivery_days'").get();
    expect(audit).toBeTruthy();
    // motivo vacío rechazado
    expect(() => upsertSetting(db, { key: "x", value: 1, updatedBy: adminId, reason: "  " })).toThrow();
  });

  it("métricas: KPIs y series con historial sembrado", () => {
    seedHistory(db); // 16 ops históricas
    const kpis = getAdminKpis(db);
    expect(kpis.totalRevenueMinor).toBeGreaterThan(0);
    expect(kpis.buyerFeeMinor).toBeGreaterThan(0);
    expect(kpis.sellerFeeMinor).toBeGreaterThan(0);
    expect(kpis.completedOps).toBeGreaterThanOrEqual(1);
    const series = getRevenueSeries(db, 12);
    expect(series.length).toBeGreaterThan(0);
    const totalSeries = series.reduce((s, m) => s + m.revenueMinor, 0);
    expect(totalSeries).toBe(kpis.totalRevenueMinor);
    const byState = getOpsByState(db);
    expect(byState.length).toBeGreaterThan(0);
    const byCountry = getRevenueByCountryCurrency(db);
    expect(byCountry.some((r) => r.countryCode === "AR" && r.revenueMinor > 0)).toBe(true);
  });

  it("usuarios: no-admin no puede, motivo obligatorio, auditoría", () => {
    expect(() => setAccountStatus(db, { adminId: sellerId, accountId: buyerId, status: "SUSPENDED", reason: "x" })).toThrow();
    expect(() => setAccountStatus(db, { adminId, accountId: buyerId, status: "SUSPENDED", reason: "" })).toThrow();
    setAccountStatus(db, { adminId, accountId: buyerId, status: "SUSPENDED", reason: "Prueba: suspender" });
    const detail = getUserDetail(db, buyerId)!;
    expect(detail.account.status).toBe("SUSPENDED");
    const audit = db.prepare("SELECT * FROM audit_record WHERE action='account.status' AND resource_id=?").get(buyerId);
    expect(audit).toBeTruthy();
    setAccountStatus(db, { adminId, accountId: buyerId, status: "ACTIVE", reason: "Restaurar" });
    // no autodeshabilitarse
    expect(() => setAccountStatus(db, { adminId, accountId: adminId, status: "SUSPENDED", reason: "x" })).toThrow();
    expect(listUsers(db, { q: "leo" }).length).toBeGreaterThanOrEqual(1);
  });

  it("catálogos: alta con auditoría y guarda para deshabilitar con operaciones activas", () => {
    saveCategory(db, { adminId, code: "TEST", labelEs: "Test", enabled: true, reason: "alta" });
    const cat = db.prepare("SELECT * FROM category_catalog WHERE category_code='TEST'").get() as { label_es: string; enabled: number };
    expect(cat.label_es).toBe("Test");
    expect(cat.enabled).toBe(1);
    saveCountry(db, { adminId, code: "UY", nameEs: "Uruguay", currencyCodes: ["UYU"], enabled: true, reason: "alta" });
    const co = db.prepare("SELECT * FROM country_catalog WHERE country_code='UY'").get() as { enabled: number };
    expect(co.enabled).toBe(1);
    // No se puede deshabilitar AR: hay política ACTIVE
    expect(() => saveCountry(db, { adminId, code: "AR", nameEs: "Argentina", currencyCodes: ["ARS"], enabled: false, reason: "quitar" })).toThrow();
    // No se puede deshabilitar GENERAL: hay política ACTIVE
    expect(() => saveCategory(db, { adminId, code: "GENERAL", labelEs: "General", enabled: false, reason: "quitar" })).toThrow();
    const audits = db.prepare("SELECT COUNT(*) AS c FROM audit_record WHERE action IN ('catalog.category.save','catalog.country.save')").get() as { c: number };
    expect(audits.c).toBeGreaterThanOrEqual(2);
  });

  it("políticas: borrador, validación de solapamiento y publicación no retroactiva", () => {
    // Crear una operación con la política ACTIVE actual para congelar su snapshot
    const opId = createOperationDraft(db, {
      sellerId,
      title: "Op para snapshot",
      description: "x",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 100000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, opId, sellerId);
    const frozenBefore = getFrozenPolicy(db, opId);
    expect(frozenBefore).toBeTruthy();

    // Crear borrador para el MISMO ámbito (no rompe, es DRAFT)
    const draft = createPolicyDraft(db, {
      adminId,
      scope: { countryCode: "AR", currency: "ARS", categoryCode: "GENERAL" },
      values: { buyerRatePct: 2, sellerRatePct: 2 },
      reason: "Borrador de prueba",
    });
    expect(draft.status).toBe("DRAFT");
    // Publicarlo debe fallar por solapamiento con ACTIVE
    const { ok } = validatePolicy(db, draft.policy_id);
    expect(ok).toBe(false);
    expect(() => publishPolicy(db, { adminId, policyId: draft.policy_id, reason: "publicar" })).toThrow();
    // Retirar el ACTIVE del ámbito y recién ahí publicar el borrador
    const activeRow = db.prepare("SELECT policy_id FROM fee_policy_version WHERE country_code='AR' AND currency='ARS' AND category_code='GENERAL' AND status='ACTIVE'").get() as { policy_id: string };
    retirePolicy(db, { adminId, policyId: activeRow.policy_id, reason: "reemplazo" });
    publishPolicy(db, { adminId, policyId: draft.policy_id, reason: "publicar nueva" });
    const published = db.prepare("SELECT status FROM fee_policy_version WHERE policy_id=?").get(draft.policy_id) as { status: string };
    expect(published.status).toBe("ACTIVE");
    // No retroactivo: la operación previa conserva su snapshot original
    const frozenAfter = getFrozenPolicy(db, opId);
    expect(frozenAfter).toBeTruthy();
    expect(frozenAfter!.buyer.rateNumerator).toBe(frozenBefore!.buyer.rateNumerator);
    // Simulación (RF-ADM-004)
    const sim = simulatePolicy(db, { scope: { countryCode: "AR", currency: "ARS", categoryCode: "GENERAL" }, baseMinor: 100000, policyId: draft.policy_id });
    expect(sim.buyerFeeMinor).toBe(2000); // 2% de 100000
  });
});
