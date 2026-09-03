/**
 * Administración de políticas de comisión (SM-POL simplificado: DRAFT | ACTIVE |
 * RETIRED; RF-ADM-001..005). Ciclo: borrador → validación (solapamientos) →
 * simulación → publicación (no retroactiva) → retiro conservando referencias.
 * Toda transición audita y exige motivo. Una política publicada NUNCA toca
 * frozen_policy_snapshot de operaciones existentes.
 */
import type { DatabaseSync } from "node:sqlite";
import { id, nowIso } from "@/data/ids";
import { asRow } from "@/data/db";
import { getAccount, type AccountRow } from "@/data/repos/account-repo";
import type { FeePolicyRow } from "@/data/repos/policy-repo";
import { recordAudit } from "@/data/infra";
import { errAuth, errValidation } from "@/domain/errors";
import { percentRule, computeBreakdown, type FinancialBreakdown } from "@/domain/fees";

export type PolicyStatus = "DRAFT" | "ACTIVE" | "RETIRED";

function requireAdmin(db: DatabaseSync, accountId: string): AccountRow {
  const acc = getAccount(db, accountId);
  if (!acc || !acc.is_admin) throw errAuth();
  return acc;
}

export interface PolicyScope {
  countryCode: string;
  currency: string;
  categoryCode: string;
}

export interface PolicyValues {
  buyerRatePct: number;
  sellerRatePct: number;
  buyerFixedMinor?: number;
  sellerFixedMinor?: number;
  buyerMinMinor?: number;
  buyerMaxMinor?: number;
  sellerMinMinor?: number;
  sellerMaxMinor?: number;
}

export function listPolicies(db: DatabaseSync): FeePolicyRow[] {
  return db
    .prepare("SELECT * FROM fee_policy_version ORDER BY effective_from DESC, version DESC LIMIT 200")
    .all() as unknown as FeePolicyRow[];
}

export function getPolicy(db: DatabaseSync, policyId: string): FeePolicyRow | undefined {
  return asRow<FeePolicyRow | undefined>(db.prepare("SELECT * FROM fee_policy_version WHERE policy_id=?").get(policyId));
}

function assertRateValid(pct: number): void {
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw errValidation("Las tasas deben estar entre 0 y 100");
}

function assertScopeExists(db: DatabaseSync, scope: PolicyScope): void {
  const cat = db.prepare("SELECT 1 AS x FROM category_catalog WHERE category_code=? AND enabled=1").get(scope.categoryCode);
  if (!cat) throw errValidation(`Categoría ${scope.categoryCode} no existe o está deshabilitada`);
  const country = db.prepare("SELECT 1 AS x FROM country_catalog WHERE country_code=? AND enabled=1").get(scope.countryCode);
  if (!country) throw errValidation(`País ${scope.countryCode} no existe o está deshabilitado`);
}

export function nextPolicyVersion(db: DatabaseSync, scope: PolicyScope): number {
  const row = db
    .prepare(
      `SELECT MAX(version) AS v FROM fee_policy_version
       WHERE country_code=? AND currency=? AND category_code=?`,
    )
    .get(scope.countryCode, scope.currency, scope.categoryCode) as { v: number | null };
  return (row.v ?? 0) + 1;
}

/** Crea un borrador de política para un ámbito (versión siguiente). */
export function createPolicyDraft(
  db: DatabaseSync,
  input: {
    adminId: string;
    scope: PolicyScope;
    values: PolicyValues;
    effectiveFrom?: string;
    reason: string;
  },
): FeePolicyRow {
  requireAdmin(db, input.adminId);
  if (!input.reason.trim()) throw errValidation("El motivo es obligatorio (RF-ADM-009)");
  assertScopeExists(db, input.scope);
  assertRateValid(input.values.buyerRatePct);
  assertRateValid(input.values.sellerRatePct);
  const version = nextPolicyVersion(db, input.scope);
  const policyId = `pol_${input.scope.countryCode.toLowerCase()}_${input.scope.currency.toLowerCase()}_${input.scope.categoryCode.toLowerCase()}_v${version}`;

  db.prepare(
    `INSERT INTO fee_policy_version
     (policy_id, country_code, currency, category_code, status, version,
      buyer_rate_num, buyer_rate_den, buyer_fixed_minor, buyer_min_minor, buyer_max_minor,
      seller_rate_num, seller_rate_den, seller_fixed_minor, seller_min_minor, seller_max_minor,
      effective_from, created_by, created_at, reason)
     VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, 10000, ?, ?, ?, ?, 10000, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    policyId,
    input.scope.countryCode,
    input.scope.currency,
    input.scope.categoryCode,
    version,
    Math.round(input.values.buyerRatePct * 10000),
    input.values.buyerFixedMinor ?? 0,
    input.values.buyerMinMinor ?? null,
    input.values.buyerMaxMinor ?? null,
    Math.round(input.values.sellerRatePct * 10000),
    input.values.sellerFixedMinor ?? 0,
    input.values.sellerMinMinor ?? null,
    input.values.sellerMaxMinor ?? null,
    input.effectiveFrom ?? nowIso(),
    input.adminId,
    nowIso(),
    input.reason,
  );
  recordAudit(db, {
    actorId: input.adminId,
    roleEffective: "ADMIN",
    action: "policy.draft",
    resourceType: "fee_policy_version",
    resourceId: policyId,
    reason: input.reason,
    after: { scope: input.scope, values: input.values, version },
  });
  return getPolicy(db, policyId)!;
}

/** Valida un borrador: no puede existir otra política ACTIVE del mismo ámbito. */
export function validatePolicy(db: DatabaseSync, policyId: string): { ok: boolean; conflicts: string[] } {
  const p = getPolicy(db, policyId);
  if (!p) throw errValidation("Política no encontrada");
  const conflicts: string[] = [];
  if (p.status === "DRAFT") {
    const active = db
      .prepare(
        `SELECT policy_id FROM fee_policy_version
         WHERE country_code=? AND currency=? AND category_code=? AND status='ACTIVE' AND policy_id<>?`,
      )
      .all(p.country_code, p.currency, p.category_code, p.policy_id) as { policy_id: string }[];
    if (active.length > 0) conflicts.push(`Ya hay una política ACTIVE (${active[0].policy_id}) para ${p.country_code}/${p.currency}/${p.category_code}`);
  }
  return { ok: conflicts.length === 0, conflicts };
}

/** Simulación de desglose con una política (RF-ADM-004) o la activa de un ámbito. */
export function simulatePolicy(
  db: DatabaseSync,
  input: { scope: PolicyScope; baseMinor: number; policyId?: string },
): FinancialBreakdown & { policyLabel: string } {
  const p = input.policyId ? getPolicy(db, input.policyId) : undefined;
  const scope = p
    ? { countryCode: p.country_code, currency: p.currency, categoryCode: p.category_code }
    : input.scope;
  const row =
    p ??
    db
      .prepare(
        `SELECT * FROM fee_policy_version WHERE country_code=? AND currency=? AND category_code=? AND status='ACTIVE'
         ORDER BY effective_from DESC LIMIT 1`,
      )
      .get(scope.countryCode, scope.currency, scope.categoryCode);
  if (!row) throw errValidation("No hay política (borrador indicado o activa) para simular");
  const policy = {
    buyer: percentRule("buyer", (row as FeePolicyRow).buyer_rate_num / 10000, {
      fixedMinor: (row as FeePolicyRow).buyer_fixed_minor,
      minMinor: (row as FeePolicyRow).buyer_min_minor ?? undefined,
      maxMinor: (row as FeePolicyRow).buyer_max_minor ?? undefined,
    }),
    seller: percentRule("seller", (row as FeePolicyRow).seller_rate_num / 10000, {
      fixedMinor: (row as FeePolicyRow).seller_fixed_minor,
      minMinor: (row as FeePolicyRow).seller_min_minor ?? undefined,
      maxMinor: (row as FeePolicyRow).seller_max_minor ?? undefined,
    }),
  };
  const b = computeBreakdown(input.baseMinor, scope.currency, policy);
  return { ...b, policyLabel: `${scope.countryCode}/${scope.currency}/${scope.categoryCode} · v${(row as FeePolicyRow).version}` };
}

/** Publica un borrador: pasa a ACTIVE (no retroactivo; solo afecta operaciones futuras). */
export function publishPolicy(db: DatabaseSync, input: { adminId: string; policyId: string; reason: string }): FeePolicyRow {
  const admin = requireAdmin(db, input.adminId);
  const p = getPolicy(db, input.policyId);
  if (!p) throw errValidation("Política no encontrada");
  if (p.status !== "DRAFT") throw errValidation(`Solo se publica un borrador (estado: ${p.status})`);
  if (!input.reason.trim()) throw errValidation("El motivo es obligatorio (RF-ADM-009)");
  const { ok, conflicts } = validatePolicy(db, input.policyId);
  if (!ok) throw errValidation(conflicts.join("; "));

  const before = p.status;
  db.prepare("UPDATE fee_policy_version SET status='ACTIVE', reason=? WHERE policy_id=?").run(input.reason, input.policyId);
  recordAudit(db, {
    actorId: input.adminId,
    roleEffective: "ADMIN",
    action: "policy.publish",
    resourceType: "fee_policy_version",
    resourceId: input.policyId,
    reason: input.reason,
    before: { status: before },
    after: { status: "ACTIVE" },
  });
  return getPolicy(db, input.policyId)!;
}

/** Retira una política ACTIVE/DRAFT (no retroactivo: las ops conservan su snapshot). */
export function retirePolicy(db: DatabaseSync, input: { adminId: string; policyId: string; reason: string }): FeePolicyRow {
  const admin = requireAdmin(db, input.adminId);
  const p = getPolicy(db, input.policyId);
  if (!p) throw errValidation("Política no encontrada");
  if (p.status !== "ACTIVE" && p.status !== "DRAFT") throw errValidation(`No se puede retirar en estado ${p.status}`);
  if (!input.reason.trim()) throw errValidation("El motivo es obligatorio (RF-ADM-009)");
  const before = p.status;
  db.prepare("UPDATE fee_policy_version SET status='RETIRED', reason=? WHERE policy_id=?").run(input.reason, input.policyId);
  recordAudit(db, {
    actorId: input.adminId,
    roleEffective: "ADMIN",
    action: "policy.retire",
    resourceType: "fee_policy_version",
    resourceId: input.policyId,
    reason: input.reason,
    before: { status: before },
    after: { status: "RETIRED" },
  });
  return getPolicy(db, input.policyId)!;
}
