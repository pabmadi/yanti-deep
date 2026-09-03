import type { DatabaseSync } from "node:sqlite";
import { nowIso, id } from "../ids";
import { asRows, asRow } from "../db";
import type { FinancialOrderState, FinancialOrderType } from "@/domain/state-machines";

export interface FinancialOrderRow {
  order_id: string;
  operation_id: string;
  order_type: FinancialOrderType;
  amount_minor: number;
  currency: string;
  state: FinancialOrderState;
  cause: string;
  cause_ref: string | null;
  idempotency_key: string;
  provider_ref: string | null;
  attempts: number;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

export function createFinancialOrder(
  db: DatabaseSync,
  o: {
    orderId: string;
    operationId: string;
    orderType: FinancialOrderType;
    amountMinor: number;
    currency: string;
    cause: string;
    causeRef?: string;
    idempotencyKey: string;
  },
): FinancialOrderRow {
  const now = nowIso();
  db.prepare(
    `INSERT INTO financial_order (order_id, operation_id, order_type, amount_minor, currency, state, cause, cause_ref, idempotency_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'INTENTION_RECORDED', ?, ?, ?, ?, ?)`,
  ).run(o.orderId, o.operationId, o.orderType, o.amountMinor, o.currency, o.cause, o.causeRef ?? null, o.idempotencyKey, now, now);
  return getOrder(db, o.orderId)!;
}

export function getOrder(db: DatabaseSync, orderId: string): FinancialOrderRow | undefined {
  return db.prepare("SELECT * FROM financial_order WHERE order_id=?").get(orderId) as FinancialOrderRow | undefined;
}

export function getOrderByOperationType(db: DatabaseSync, operationId: string, orderType: FinancialOrderType): FinancialOrderRow | undefined {
  return db
    .prepare("SELECT * FROM financial_order WHERE operation_id=? AND order_type=? ORDER BY created_at DESC LIMIT 1")
    .get(operationId, orderType) as FinancialOrderRow | undefined;
}

export function getOrderByIdempotencyKey(db: DatabaseSync, key: string): FinancialOrderRow | undefined {
  return db.prepare("SELECT * FROM financial_order WHERE idempotency_key=?").get(key) as FinancialOrderRow | undefined;
}

export function getOrdersByOperation(db: DatabaseSync, operationId: string): FinancialOrderRow[] {
  return asRows<FinancialOrderRow>(db.prepare("SELECT * FROM financial_order WHERE operation_id=? ORDER BY created_at ASC").all(operationId));
}

export function updateOrderState(
  db: DatabaseSync,
  orderId: string,
  to: FinancialOrderState,
  opts: { providerRef?: string; errorCode?: string } = {},
): FinancialOrderRow {
  const now = nowIso();
  const sets: string[] = ["state=?", "updated_at=?", "attempts=attempts+1"];
  const vals: Array<string | number | null> = [to, now];
  if (opts.providerRef !== undefined) { sets.push("provider_ref=?"); vals.push(opts.providerRef); }
  if (opts.errorCode !== undefined) { sets.push("error_code=?"); vals.push(opts.errorCode); }
  if (to === "CONFIRMED") { sets.push("confirmed_at=?"); vals.push(now); }
  vals.push(orderId);
  db.prepare(`UPDATE financial_order SET ${sets.join(", ")} WHERE order_id=?`).run(...vals);
  return asRow<FinancialOrderRow>(db.prepare("SELECT * FROM financial_order WHERE order_id=?").get(orderId));
}
