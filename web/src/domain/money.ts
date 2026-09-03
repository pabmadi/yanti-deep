/**
 * Dinero: importes SIEMPRE en unidades menores (enteras) + código ISO 4217.
 * Nunca números de punto flotante para importes (doc 03/06/07). (INV-FIN, PF-INV-001)
 */

export type CurrencyCode = string; // ISO 4217, p.ej. "ARS", "BRL", "MXN"

export interface Money {
  amountMinor: number; // entero
  currency: CurrencyCode;
}

export const money = (amountMinor: number, currency: CurrencyCode): Money => {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("amountMinor debe ser entero seguro");
  return { amountMinor, currency };
};

export const zero = (currency: CurrencyCode): Money => money(0, currency);

export const add = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new Error("monedas distintas");
  return money(a.amountMinor + b.amountMinor, a.currency);
};

export const sub = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new Error("monedas distintas");
  return money(a.amountMinor - b.amountMinor, a.currency);
};

export const isNonNegative = (m: Money) => m.amountMinor >= 0;
export const isPositive = (m: Money) => m.amountMinor > 0;
export const isZero = (m: Money) => m.amountMinor === 0;

export const eq = (a: Money, b: Money) => a.currency === b.currency && a.amountMinor === b.amountMinor;
export const lte = (a: Money, b: Money) => a.currency === b.currency && a.amountMinor <= b.amountMinor;
export const gte = (a: Money, b: Money) => a.currency === b.currency && a.amountMinor >= b.amountMinor;

/** Convierte importe decimal de entrada del usuario a unidades menores, con redondeo a entero. */
export const fromDecimal = (decimal: number, currency: CurrencyCode, minorPerUnit = 100): Money => {
  if (!Number.isFinite(decimal)) throw new Error("importe inválido");
  const minor = Math.round(decimal * minorPerUnit);
  return money(minor, currency);
};

export const toDecimal = (m: Money, minorPerUnit = 100) => m.amountMinor / minorPerUnit;
