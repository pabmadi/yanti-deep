import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "../ids";
import type { FeePolicy } from "@/domain/fees";
import { percentRule } from "@/domain/fees";

export interface FeePolicyRow {
  policy_id: string;
  country_code: string;
  currency: string;
  category_code: string;
  status: string;
  version: number;
  buyer_rate_num: number;
  buyer_rate_den: number;
  buyer_fixed_minor: number;
  buyer_min_minor: number | null;
  buyer_max_minor: number | null;
  seller_rate_num: number;
  seller_rate_den: number;
  seller_fixed_minor: number;
  seller_min_minor: number | null;
  seller_max_minor: number | null;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
  created_at: string;
  reason: string | null;
}

export function toFeePolicy(row: FeePolicyRow): FeePolicy {
  return {
    buyer: {
      id: `buyer:${row.policy_id}:v${row.version}`,
      rateNumerator: row.buyer_rate_num,
      rateDenominator: row.buyer_rate_den,
      fixedMinor: row.buyer_fixed_minor,
      minMinor: row.buyer_min_minor ?? undefined,
      maxMinor: row.buyer_max_minor ?? undefined,
      roundingMode: "HALF_UP",
    },
    seller: {
      id: `seller:${row.policy_id}:v${row.version}`,
      rateNumerator: row.seller_rate_num,
      rateDenominator: row.seller_rate_den,
      fixedMinor: row.seller_fixed_minor,
      minMinor: row.seller_min_minor ?? undefined,
      maxMinor: row.seller_max_minor ?? undefined,
      roundingMode: "HALF_UP",
    },
  };
}

/** Política vigente activa para país/moneda/categoría en la fecha. */
export function findActiveFeePolicy(
  db: DatabaseSync,
  scope: { countryCode: string; currency: string; categoryCode: string; at?: string },
): FeePolicyRow | undefined {
  const at = scope.at ?? nowIso();
  return db
    .prepare(
      `SELECT * FROM fee_policy_version
       WHERE country_code=? AND currency=? AND category_code=? AND status='ACTIVE' AND effective_from <= ?
       ORDER BY effective_from DESC LIMIT 1`,
    )
    .get(scope.countryCode, scope.currency, scope.categoryCode, at) as FeePolicyRow | undefined;
}

/** Seed de la política de prueba local (valores etiquetados como prueba, no productivos). */
export function seedFeePolicy(db: DatabaseSync): void {
  const now = nowIso();
  db.prepare(
    `INSERT OR IGNORE INTO fee_policy_version
     (policy_id, country_code, currency, category_code, status, version, buyer_rate_num, buyer_rate_den, buyer_fixed_minor, seller_rate_num, seller_rate_den, seller_fixed_minor, effective_from, created_at, reason)
     VALUES (?, 'AR', 'ARS', 'GENERAL', 'ACTIVE', 1, ?, 10000, 0, ?, 10000, 0, ?, ?, 'Política de prueba local R00-R02; NO productiva')`,
  ).run(
    "pol_test_ar_ars",
    Math.round(0.01 * 10000),
    Math.round(0.01 * 10000),
    "2000-01-01T00:00:00.000Z",
    now,
  );
}
