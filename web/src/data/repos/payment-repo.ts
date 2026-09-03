import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "../ids";
import type { PaymentAttemptState } from "@/domain/state-machines";

export interface PaymentAttemptRow {
  attempt_id: string;
  operation_id: string;
  provider: string;
  provider_ref: string | null;
  state: PaymentAttemptState;
  requested_total_minor: number;
  currency: string;
  observed_total_minor: number | null;
  observed_currency: string | null;
  external_account: string | null;
  idempotency_key: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  accredited_at: string | null;
}

export function createPaymentAttempt(
  db: DatabaseSync,
  a: {
    attemptId: string;
    operationId: string;
    requestedTotalMinor: number;
    currency: string;
    idempotencyKey: string;
    createdBy: string;
  },
): PaymentAttemptRow {
  const now = nowIso();
  db.prepare(
    `INSERT INTO payment_attempt (attempt_id, operation_id, provider, state, requested_total_minor, currency, idempotency_key, created_by, created_at, updated_at)
     VALUES (?, ?, 'fake', 'CREATED', ?, ?, ?, ?, ?, ?)`,
  ).run(
    a.attemptId,
    a.operationId,
    a.requestedTotalMinor,
    a.currency,
    a.idempotencyKey,
    a.createdBy,
    now,
    now,
  );
  return getAttempt(db, a.attemptId)!;
}

export function getAttempt(db: DatabaseSync, attemptId: string): PaymentAttemptRow | undefined {
  return db.prepare("SELECT * FROM payment_attempt WHERE attempt_id = ?").get(attemptId) as PaymentAttemptRow | undefined;
}

export function getAttemptByRef(db: DatabaseSync, providerRef: string): PaymentAttemptRow | undefined {
  return db.prepare("SELECT * FROM payment_attempt WHERE provider_ref = ?").get(providerRef) as PaymentAttemptRow | undefined;
}

export function getLatestAttempt(db: DatabaseSync, operationId: string): PaymentAttemptRow | undefined {
  return db
    .prepare("SELECT * FROM payment_attempt WHERE operation_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(operationId) as PaymentAttemptRow | undefined;
}

export function getAccreditedAttempt(db: DatabaseSync, operationId: string): PaymentAttemptRow | undefined {
  return db
    .prepare("SELECT * FROM payment_attempt WHERE operation_id = ? AND state = 'ACCREDITED' LIMIT 1")
    .get(operationId) as PaymentAttemptRow | undefined;
}

export function updateAttemptState(
  db: DatabaseSync,
  attemptId: string,
  to: PaymentAttemptState,
  opts: { providerRef?: string; observedTotalMinor?: number; observedCurrency?: string; externalAccount?: string } = {},
): PaymentAttemptRow {
  const now = nowIso();
  const cur = getAttempt(db, attemptId);
  if (!cur) throw new Error("attempt not found");
  const sets: string[] = ["state=?", "updated_at=?"];
  const vals: Array<string | number | null> = [to, now];
  if (opts.providerRef !== undefined) { sets.push("provider_ref=?"); vals.push(opts.providerRef); }
  if (opts.observedTotalMinor !== undefined) { sets.push("observed_total_minor=?"); vals.push(opts.observedTotalMinor); }
  if (opts.observedCurrency !== undefined) { sets.push("observed_currency=?"); vals.push(opts.observedCurrency); }
  if (opts.externalAccount !== undefined) { sets.push("external_account=?"); vals.push(opts.externalAccount); }
  if (to === "ACCREDITED") { sets.push("accredited_at=?"); vals.push(now); }
  vals.push(attemptId);
  db.prepare(`UPDATE payment_attempt SET ${sets.join(", ")} WHERE attempt_id=?`).run(...vals);
  return getAttempt(db, attemptId)!;
}

/** ¿Existe ya un intento acreditado? (INV-FIN-002: máximo 1). */
export function hasAccreditedAttempt(db: DatabaseSync, operationId: string): boolean {
  return getAccreditedAttempt(db, operationId) !== undefined;
}
