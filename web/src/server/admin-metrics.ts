/**
 * Métricas administrativas (dashboard admin). Fuente de verdad: el ledger
 * append-only para dinero (postings de BUYER_FEE_REVENUE / SELLER_FEE_REVENUE)
 * y las tablas de hechos (operation, dispute) para volumen y estado.
 * Regla anti doble conteo: solo postings de asientos POSTED; cada agregado
 * se hace por fila del ledger (cada asiento se emite una sola vez por causa).
 */
import type { DatabaseSync } from "node:sqlite";
import { asRows } from "@/data/db";

/** Fecha del hecho para series: posted_at del ledger (contable, inmutable). */
export interface AdminKpis {
  currency: string;
  buyerFeeMinor: number;
  sellerFeeMinor: number;
  totalRevenueMinor: number;
  completedOps: number;
  inFlightOps: number;
  pendingReconcile: number;
  openDisputes: number;
  avgResolutionHours: number | null;
}

export function getAdminKpis(db: DatabaseSync): AdminKpis {
  // Ingreso de Yanti por comisiones: neto CREDIT - DEBIT en cuentas de revenue.
  const rev = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN logical_account='BUYER_FEE_REVENUE' AND side='CREDIT' THEN amount_minor
                           WHEN logical_account='BUYER_FEE_REVENUE' AND side='DEBIT' THEN -amount_minor END), 0) AS buyer_fee,
         COALESCE(SUM(CASE WHEN logical_account='SELLER_FEE_REVENUE' AND side='CREDIT' THEN amount_minor
                           WHEN logical_account='SELLER_FEE_REVENUE' AND side='DEBIT' THEN -amount_minor END), 0) AS seller_fee,
         MAX(le.currency) AS currency
       FROM ledger_posting lp JOIN ledger_entry le ON le.entry_id = lp.entry_id
       WHERE le.state='POSTED' AND logical_account IN ('BUYER_FEE_REVENUE','SELLER_FEE_REVENUE')`,
    )
    .get() as { buyer_fee: number; seller_fee: number; currency: string | null };

  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM operation WHERE state IN ('COMPLETED','REFUNDED')) AS completed_ops,
         (SELECT COUNT(*) FROM operation WHERE state NOT IN ('COMPLETED','REFUNDED','CANCELLED','EXPIRED')) AS inflight_ops,
         (SELECT COUNT(*) FROM payment_attempt WHERE state='ACCREDITED_PENDING_RECONCILIATION') AS pending_reconcile,
         (SELECT COUNT(*) FROM dispute WHERE state IN ('OPEN','AWAITING_RESPONSE','COLLECTING_EVIDENCE','UNDER_REVIEW','AWAITING_INFORMATION','PROPOSED_RESOLUTION','PENDING_SECOND_APPROVAL')) AS open_disputes`,
    )
    .get() as { completed_ops: number; inflight_ops: number; pending_reconcile: number; open_disputes: number };

  const resolution = db
    .prepare(
      `SELECT AVG((julianday(resolved_at) - julianday(opened_at)) * 24) AS avg_hours
       FROM dispute WHERE resolved_at IS NOT NULL AND opened_at IS NOT NULL`,
    )
    .get() as { avg_hours: number | null };

  const buyerFee = rev.buyer_fee ?? 0;
  const sellerFee = rev.seller_fee ?? 0;
  return {
    currency: rev.currency ?? "ARS",
    buyerFeeMinor: buyerFee,
    sellerFeeMinor: sellerFee,
    totalRevenueMinor: buyerFee + sellerFee,
    completedOps: counts.completed_ops,
    inFlightOps: counts.inflight_ops,
    pendingReconcile: counts.pending_reconcile,
    openDisputes: counts.open_disputes,
    avgResolutionHours: resolution.avg_hours,
  };
}

export interface MonthPoint {
  month: string; // 'YYYY-MM'
  buyerFeeMinor: number;
  sellerFeeMinor: number;
  revenueMinor: number;
}

/** Serie mensual de comisiones (ingreso Yanti) desde el ledger, últimos N meses. */
export function getRevenueSeries(db: DatabaseSync, months = 12): MonthPoint[] {
  const rows = asRows<{ month: string; buyer_fee: number; seller_fee: number }>(
    db
      .prepare(
        `SELECT strftime('%Y-%m', le.posted_at) AS month,
                COALESCE(SUM(CASE WHEN lp.side='CREDIT' THEN lp.amount_minor ELSE -lp.amount_minor END), 0) AS buyer_fee,
                0 AS seller_fee
         FROM ledger_posting lp JOIN ledger_entry le ON le.entry_id = lp.entry_id
         WHERE le.state='POSTED' AND lp.logical_account='BUYER_FEE_REVENUE'
         GROUP BY month ORDER BY month ASC`,
      )
      .all(),
  );
  const sellerRows = asRows<{ month: string; seller_fee: number }>(
    db
      .prepare(
        `SELECT strftime('%Y-%m', le.posted_at) AS month,
                COALESCE(SUM(CASE WHEN lp.side='CREDIT' THEN lp.amount_minor ELSE -lp.amount_minor END), 0) AS seller_fee
         FROM ledger_posting lp JOIN ledger_entry le ON le.entry_id = lp.entry_id
         WHERE le.state='POSTED' AND lp.logical_account='SELLER_FEE_REVENUE'
         GROUP BY month ORDER BY month ASC`,
      )
      .all(),
  );
  const buyerByMonth = new Map(rows.map((r) => [r.month, r.buyer_fee]));
  const sellerByMonth = new Map(sellerRows.map((r) => [r.month, r.seller_fee]));
  const keys = new Set([...buyerByMonth.keys(), ...sellerByMonth.keys()]);
  return [...keys]
    .sort()
    .slice(-months)
    .map((month) => {
      const buyer = buyerByMonth.get(month) ?? 0;
      const seller = sellerByMonth.get(month) ?? 0;
      // Objetos literales planos (props a client components).
      return { month, buyerFeeMinor: buyer, sellerFeeMinor: seller, revenueMinor: buyer + seller };
    });
}

export interface VolumePoint {
  month: string;
  completedCount: number;
  baseVolumeMinor: number;
}

/** Volumen de operaciones COMPLETADAS por mes (usa completed_at). */
export function getVolumeSeries(db: DatabaseSync, months = 12): VolumePoint[] {
  const rows = asRows<{ month: string; count: number; base: number }>(
    db
      .prepare(
        `SELECT strftime('%Y-%m', completed_at) AS month,
                COUNT(*) AS count, COALESCE(SUM(base_amount_minor), 0) AS base
         FROM operation WHERE state='COMPLETED' AND completed_at IS NOT NULL
         GROUP BY month ORDER BY month ASC`,
      )
      .all(),
  );
  return rows.slice(-months).map((r) => ({ month: r.month, completedCount: Number(r.count), baseVolumeMinor: r.base }));
}

export interface StateCount {
  state: string;
  count: number;
}

/** Distribución de operaciones por estado actual. */
export function getOpsByState(db: DatabaseSync): StateCount[] {
  const rows = asRows<StateCount>(
    db.prepare("SELECT state, COUNT(*) AS count FROM operation GROUP BY state ORDER BY count DESC").all(),
  );
  // SQLite devuelve filas con null prototype; aplanar a objetos literales para props de client.
  return rows.map((r) => ({ state: r.state, count: Number(r.count) }));
}

export interface RevenueByScope {
  countryCode: string;
  currency: string;
  revenueMinor: number;
}

/** Comisiones por país/moneda (join a operation vía entry). */
export function getRevenueByCountryCurrency(db: DatabaseSync): RevenueByScope[] {
  return asRows<RevenueByScope>(
    db
      .prepare(
        `SELECT o.country_code AS countryCode, le.currency AS currency,
                COALESCE(SUM(CASE WHEN lp.side='CREDIT' THEN lp.amount_minor ELSE -lp.amount_minor END), 0) AS revenueMinor
         FROM ledger_posting lp
         JOIN ledger_entry le ON le.entry_id = lp.entry_id
         JOIN operation o ON o.operation_id = le.operation_id
         WHERE le.state='POSTED' AND lp.logical_account IN ('BUYER_FEE_REVENUE','SELLER_FEE_REVENUE')
         GROUP BY o.country_code, le.currency ORDER BY revenueMinor DESC`,
      )
      .all(),
  );
}

export interface DisputeMetric {
  totalDisputes: number;
  openDisputes: number;
  resolvedDisputes: number;
  outcomeCounts: Array<{ outcome: string; count: number }>;
  avgResolutionHours: number | null;
}

/** Métricas de disputas: tasa, tiempo medio de resolución y outcomes. */
export function getDisputeMetrics(db: DatabaseSync): DisputeMetric {
  const total = (db.prepare("SELECT COUNT(*) AS c FROM dispute").get() as { c: number }).c;
  const open = (db.prepare("SELECT COUNT(*) AS c FROM dispute WHERE state IN ('OPEN','AWAITING_RESPONSE','COLLECTING_EVIDENCE','UNDER_REVIEW','AWAITING_INFORMATION','PROPOSED_RESOLUTION','PENDING_SECOND_APPROVAL')").get() as { c: number }).c;
  const resolved = total - open;
  const outcomeCounts = asRows<{ outcome: string; count: number }>(
    db
      .prepare(
        `SELECT outcome, COUNT(*) AS count FROM resolution WHERE state='CONFIRMED' GROUP BY outcome ORDER BY count DESC`,
      )
      .all(),
  );
  const avg = (db.prepare("SELECT AVG((julianday(resolved_at) - julianday(opened_at)) * 24) AS avg_hours FROM dispute WHERE resolved_at IS NOT NULL AND opened_at IS NOT NULL").get() as { avg_hours: number | null }).avg_hours;
  return { totalDisputes: total, openDisputes: open, resolvedDisputes: resolved, outcomeCounts, avgResolutionHours: avg };
}
