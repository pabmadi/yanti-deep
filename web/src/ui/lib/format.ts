/** Formato de dinero y fechas según locale (doc: cifras tabulares, ISO 4217 visible). */
import { toDecimal } from "@/domain/money";

const MINOR_UNITS: Record<string, number> = { ARS: 100, BRL: 100, MXN: 100, USD: 100, CLP: 1, COP: 1 };

export function formatMoney(amountMinor: number, currency: string, locale = "es-AR"): string {
  const unit = MINOR_UNITS[currency] ?? 100;
  const value = amountMinor / unit;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: unit === 1 ? 0 : 2,
    maximumFractionDigits: unit === 1 ? 0 : 2,
  });
  return formatter.format(value);
}

export function formatMinorWithCode(amountMinor: number, currency: string): string {
  const unit = MINOR_UNITS[currency] ?? 100;
  const value = amountMinor / unit;
  return `${currency} ${value.toLocaleString("es-AR", { minimumFractionDigits: unit === 1 ? 0 : 2, maximumFractionDigits: unit === 1 ? 0 : 2 })}`;
}

export function formatDate(iso: string, locale = "es-AR"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d);
}

export function formatDeadline(iso: string, locale = "es-AR"): string {
  return formatDate(iso, locale);
}

/** Desglose legible de un monto en unidades menores. */
export function minorToDecimal(amountMinor: number, currency: string): string {
  return formatMinorWithCode(amountMinor, currency);
}
