import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "../ids";
import { asRows, asRow } from "../db";
import type { OperationState, HoldType, HeldAction } from "@/domain/state-machines";
import { HOLDS_BLOCKING } from "@/domain/state-machines";
import { errHeld, errVersion } from "@/domain/errors";

export interface OperationRow {
  operation_id: string;
  support_code: string;
  title: string;
  description: string;
  country_code: string;
  currency: string;
  base_amount_minor: number;
  category_code: string;
  external_link: string | null;
  state: OperationState;
  state_reason: string | null;
  seller_id: string;
  buyer_id: string | null;
  buyer_email: string | null;
  expected_delivery_days: number;
  version: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
}

export interface HoldRow {
  hold_id: string;
  operation_id: string;
  hold_type: HoldType;
  blocked_actions: string;
  origin: string;
  origin_ref: string | null;
  status: "ACTIVE" | "RELEASED";
  created_at: string;
  released_at: string | null;
  released_by: string | null;
  released_reason: string | null;
}

export function getOperation(db: DatabaseSync, operationId: string): OperationRow | undefined {
  return db.prepare("SELECT * FROM operation WHERE operation_id = ?").get(operationId) as OperationRow | undefined;
}

/**
 * Lista operaciones donde el usuario es comprador o vendedor.
 * La pertenencia incluye al comprador invitado por email aunque todavía no haya
 * aceptado (no está en operation_party hasta aceptar): si su correo coincide con
 * buyer_email de una operación no vinculada, debe verla como pendiente.
 */
export function listOperationsForAccount(db: DatabaseSync, accountId: string): OperationRow[] {
  const account = asRow<{ email_canonical: string } | undefined>(
    db.prepare("SELECT email_canonical FROM account WHERE account_id = ?").get(accountId),
  );
  if (!account) return [];
  return asRows<OperationRow>(
    db
      .prepare(
        `SELECT o.* FROM operation o
         WHERE o.operation_id IN (
           SELECT operation_id FROM operation_party WHERE account_id = ?
         )
         OR (
           o.buyer_id IS NULL
           AND o.buyer_email = ?
           AND o.state IN ('AWAITING_ACCEPTANCE', 'ACCEPTED_AWAITING_PAYMENT')
         )
         ORDER BY o.created_at DESC`,
      )
      .all(accountId, account.email_canonical),
  );
}

export function listOperationsByState(db: DatabaseSync, states: string[]): OperationRow[] {
  const marks = states.map(() => "?").join(",");
  return asRows<OperationRow>(
    db.prepare(`SELECT * FROM operation WHERE state IN (${marks}) ORDER BY updated_at ASC`).all(...states),
  );
}

export function updateOperationState(
  db: DatabaseSync,
  operationId: string,
  to: OperationState,
  opts: { reason?: string; expectedVersion?: number } = {},
): OperationRow {
  const cur = getOperation(db, operationId);
  if (!cur) throw new Error("operation not found");
  if (opts.expectedVersion !== undefined && cur.version !== opts.expectedVersion) throw errVersion();
  const now = nowIso();
  db.prepare(
    `UPDATE operation SET state=?, state_reason=?, version=version+1, updated_at=? WHERE operation_id=?`,
  ).run(to, opts.reason ?? null, now, operationId);
  const updated = getOperation(db, operationId)!;
  const after: Record<string, unknown> = {};
  if (to === "PAID_AWAITING_SHIPMENT") {
    db.prepare(`UPDATE operation SET paid_at=? WHERE operation_id=?`).run(now, operationId);
    after.paid_at = now;
  }
  if (to === "SHIPPED_AWAITING_RECEIPT") {
    db.prepare(`UPDATE operation SET shipped_at=? WHERE operation_id=?`).run(now, operationId);
    after.shipped_at = now;
  }
  if (to === "COMPLETED" || to === "REFUNDED") {
    db.prepare(`UPDATE operation SET completed_at=? WHERE operation_id=?`).run(now, operationId);
    after.completed_at = now;
  }
  return getOperation(db, operationId)!;
}

/** Proyección del rol del usuario en la operación. */
export function getPartyRole(db: DatabaseSync, operationId: string, accountId: string): "BUYER" | "SELLER" | undefined {
  const row = db
    .prepare("SELECT role FROM operation_party WHERE operation_id = ? AND account_id = ?")
    .get(operationId, accountId) as { role: "BUYER" | "SELLER" } | undefined;
  return row?.role;
}

/**
 * Rol efectivo del usuario en una operación, incluyendo al comprador invitado por email
 * que aún no aceptó (todavía no está en operation_party pero debe ver la solicitud).
 */
export function resolveRoleForOperation(
  db: DatabaseSync,
  op: OperationRow,
  accountId: string,
  accountEmail?: string,
): "BUYER" | "SELLER" | undefined {
  const partyRole = getPartyRole(db, op.operation_id, accountId);
  if (partyRole) return partyRole;
  if (op.seller_id === accountId) return "SELLER";
  const email = accountEmail;
  if (
    email &&
    !op.buyer_id &&
    op.buyer_email?.toLowerCase() === email.toLowerCase() &&
    ["AWAITING_ACCEPTANCE", "ACCEPTED_AWAITING_PAYMENT"].includes(op.state)
  ) {
    return "BUYER";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Holds                                                               */
/* ------------------------------------------------------------------ */
export function getActiveHolds(db: DatabaseSync, operationId: string): HoldRow[] {
  return asRows<HoldRow>(
    db.prepare("SELECT * FROM hold WHERE operation_id = ? AND status = 'ACTIVE'").all(operationId),
  );
}

/** Acciones efectivamente bloqueadas por los holds activos. */
export function blockedActionsFor(db: DatabaseSync, operationId: string): HeldAction[] {
  const holds = getActiveHolds(db, operationId);
  const blocked = new Set<HeldAction>();
  for (const h of holds) {
    const actions = JSON.parse(h.blocked_actions) as HeldAction[];
    for (const a of actions) blocked.add(a);
  }
  return [...blocked];
}

export function assertNotHeld(db: DatabaseSync, operationId: string, action: HeldAction): void {
  const activeHolds = getActiveHolds(db, operationId);
  const blocking = activeHolds
    .filter((h) => (JSON.parse(h.blocked_actions) as HeldAction[]).includes(action))
    .map((h) => h.hold_type);
  if (blocking.length > 0) throw errHeld(blocking);
}

export function addHold(
  db: DatabaseSync,
  operationId: string,
  holdType: HoldType,
  origin: string,
  originRef?: string,
): HoldRow {
  // Acciones bloqueadas: las que este tipo de hold bloquea (según HOLDS_BLOCKING).
  const actions = Object.entries(HOLDS_BLOCKING)
    .filter(([, types]) => types.includes(holdType))
    .map(([action]) => action);
  const holdId = randomUUID();
  db.prepare(
    `INSERT INTO hold (hold_id, operation_id, hold_type, blocked_actions, origin, origin_ref, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
  ).run(holdId, operationId, holdType, JSON.stringify(actions), origin, originRef ?? null, nowIso());
  return getActiveHolds(db, operationId).find((h) => h.hold_id === holdId)!;
}

export function releaseHold(
  db: DatabaseSync,
  operationId: string,
  holdType: HoldType,
  by: string,
  reason: string,
): void {
  const now = nowIso();
  db.prepare(
    `UPDATE hold SET status='RELEASED', released_at=?, released_by=?, released_reason=? WHERE operation_id=? AND hold_type=? AND status='ACTIVE'`,
  ).run(now, by, reason, operationId, holdType);
}
