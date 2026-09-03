/**
 * Motor de comisiones y desglose financiero (doc 07 §7).
 * Fórmula canónica: percent = Round(B * r_n / r_d, mode); fee = clamp(percent + fixed, min, max).
 * Sin floats binarios para tasas (rate_numerator / rate_denominator). Todo en unidades menores.
 */
import { Money, add, sub } from "./money";

export type RoundingMode = "HALF_UP" | "ROUND_UP" | "ROUND_DOWN";

/** Redondeo de unidades menores. HALF_UP sobre mitad exacta. */
export function roundMinor(n: number, mode: RoundingMode): number {
  switch (mode) {
    case "HALF_UP": {
      const floor = Math.floor(n);
      return n - floor >= 0.5 ? floor + 1 : floor;
    }
    case "ROUND_UP":
      return Math.ceil(n);
    case "ROUND_DOWN":
      return Math.floor(n);
  }
}

export interface FeeRule {
  id: string;
  /** Tasa racional: percent = base * rateNumerator / rateDenominator */
  rateNumerator: number;
  rateDenominator: number;
  fixedMinor?: number;
  minMinor?: number;
  maxMinor?: number;
  roundingMode: RoundingMode;
}

export interface FeeComponent {
  rule: FeeRule;
  label: string;
}

/** Calcula la comisión en unidades menores sobre una base (unidades menores). */
export function computeFee(baseMinor: number, rule: FeeRule): number {
  const percent = roundMinor((baseMinor * rule.rateNumerator) / rule.rateDenominator, rule.roundingMode);
  const withFixed = percent + (rule.fixedMinor ?? 0);
  let fee = withFixed;
  if (rule.minMinor !== undefined) fee = Math.max(fee, rule.minMinor);
  if (rule.maxMinor !== undefined) fee = Math.min(fee, rule.maxMinor);
  return fee;
}

export interface FeePolicy {
  buyer: FeeRule;
  seller: FeeRule;
}

export interface FinancialBreakdown {
  currency: string;
  baseMinor: number;
  buyerFeeMinor: number;
  knownTaxesMinor: number;
  buyerTotalMinor: number; // base + buyerFee + knownTaxes
  sellerFeeMinor: number;
  sellerNetMinor: number; // base - sellerFee
}

export function computeBreakdown(
  baseMinor: number,
  currency: string,
  policy: FeePolicy,
  knownTaxesMinor = 0,
): FinancialBreakdown {
  const buyerFeeMinor = computeFee(baseMinor, policy.buyer);
  const sellerFeeMinor = computeFee(baseMinor, policy.seller);
  const buyerTotalMinor = baseMinor + buyerFeeMinor + knownTaxesMinor;
  const sellerNetMinor = baseMinor - sellerFeeMinor;
  return {
    currency,
    baseMinor,
    buyerFeeMinor,
    knownTaxesMinor,
    buyerTotalMinor,
    sellerNetMinor: sellerNetMinor,
    sellerFeeMinor,
  };
}

/** Verifica que el desglose reconciliar exactamente (doc 06). */
export function assertBreakdownReconciles(b: FinancialBreakdown): void {
  if (b.buyerTotalMinor !== b.baseMinor + b.buyerFeeMinor + b.knownTaxesMinor) {
    throw new Error("ERR_MONEY: buyerTotal no reconcilia");
  }
  if (b.sellerNetMinor !== b.baseMinor - b.sellerFeeMinor) {
    throw new Error("ERR_MONEY: sellerNet no reconcilia");
  }
}

export const toMoney = (b: FinancialBreakdown): { base: Money; buyerTotal: Money; sellerNet: Money; buyerFee: Money; sellerFee: Money } => ({
  base: { amountMinor: b.baseMinor, currency: b.currency },
  buyerTotal: { amountMinor: b.buyerTotalMinor, currency: b.currency },
  sellerNet: { amountMinor: b.sellerNetMinor, currency: b.currency },
  buyerFee: { amountMinor: b.buyerFeeMinor, currency: b.currency },
  sellerFee: { amountMinor: b.sellerFeeMinor, currency: b.currency },
});

/** Convierte una tasa de porcentaje (1% → {1,100}) a FeeRule. */
export const percentRule = (
  id: string,
  percent: number,
  opts: Partial<Omit<FeeRule, "id" | "rateNumerator" | "rateDenominator">> = {},
): FeeRule => {
  const d = 10000; // precisión 0.0001
  return {
    id,
    rateNumerator: Math.round(percent * d),
    rateDenominator: 100 * d,
    roundingMode: "HALF_UP",
    ...opts,
  };
};
