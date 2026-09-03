/**
 * Servicio de política: resuelve la fee policy activa para una combinación
 * país/moneda/categoría y congela snapshots inmutables por operación.
 * (doc 03 SM-POL, doc 07 §7, INV-OPS-005)
 */
import type { DatabaseSync } from "node:sqlite";
import { nowIso, id } from "@/data/ids";
import { findActiveFeePolicy, toFeePolicy, type FeePolicyRow } from "@/data/repos/policy-repo";
import { computeBreakdown, type FinancialBreakdown, type FeePolicy } from "@/domain/fees";
import { errDecisionPending, errValidation, errVersion } from "@/domain/errors";

export interface PolicyScope {
  countryCode: string;
  currency: string;
  categoryCode: string;
}

export function resolveFeePolicy(db: DatabaseSync, scope: PolicyScope): FeePolicy | null {
  const row = findActiveFeePolicy(db, scope);
  return row ? toFeePolicy(row) : null;
}

/**
 * Calcula el desglose financiero con la política activa.
 * Si no hay política activa: DECISION_PENDING (nunca se inventa un valor).
 */
export function quoteBreakdown(db: DatabaseSync, scope: PolicyScope, baseMinor: number): FinancialBreakdown {
  const policy = resolveFeePolicy(db, scope);
  if (!policy) {
    throw errDecisionPending(
      `política de comisiones para ${scope.countryCode}/${scope.currency}/${scope.categoryCode}`,
    );
  }
  return computeBreakdown(baseMinor, scope.currency, policy);
}

export interface FrozenPolicy {
  snapshotId: string;
  policy: FeePolicy;
  policyRow: FeePolicyRow;
  frozenAt: string;
}

/** Congela la política aplicable en la operación (copiará la versión activa). */
export function freezePolicy(db: DatabaseSync, operationId: string, scope: PolicyScope): FrozenPolicy {
  const row = findActiveFeePolicy(db, scope);
  if (!row) throw errDecisionPending(`política de comisiones para ${scope.countryCode}/${scope.currency}/${scope.categoryCode}`);
  const policy = toFeePolicy(row);
  const snapshotId = id("fps");
  db.prepare(
    `INSERT INTO frozen_policy_snapshot (snapshot_id, operation_id, country_code, currency, category_code, policy_id, policy_version, payload_json, frozen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    snapshotId,
    operationId,
    scope.countryCode,
    scope.currency,
    scope.categoryCode,
    row.policy_id,
    row.version,
    JSON.stringify(policy),
    nowIso(),
  );
  return { snapshotId, policy, policyRow: row, frozenAt: nowIso() };
}

export function getFrozenPolicy(db: DatabaseSync, operationId: string): FeePolicy | null {
  const row = db
    .prepare("SELECT * FROM frozen_policy_snapshot WHERE operation_id=? ORDER BY frozen_at DESC LIMIT 1")
    .get(operationId) as { payload_json: string } | undefined;
  return row ? (JSON.parse(row.payload_json) as FeePolicy) : null;
}

/** Redondeo y validación de montos: min/max configurables por moneda. */
export function validateAmountRange(db: DatabaseSync, currency: string, amountMinor: number): void {
  if (amountMinor <= 0) throw errValidation("El monto debe ser positivo");
  if (!Number.isSafeInteger(amountMinor)) throw errValidation("Monto inválido");
  if (currency !== "ARS" && currency !== "BRL" && currency !== "MXN" && currency !== "USD") {
    throw errValidation("Moneda no soportada");
  }
}
