import type { DatabaseSync } from "node:sqlite";
import { asRows } from "@/data/db";
import { listOperationsForAccount } from "@/data/repos/operation-repo";

export interface NotificationItem {
  notificationId: string;
  body: string;
  operationId: string | null;
  operationTitle: string | null;
  operationState: string | null;
  operationHref: string | null;
  deadline: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  notification_id: string;
  body: string;
  operation_id: string | null;
  deadline: string | null;
  read_at: string | null;
  created_at: string;
}

/** El cuerpo es histórico: elimina promesas antiguas de automatismos y remite al estado vigente. */
export function historicalNotificationText(body: string): string {
  return body
    .replace(/La liberación automática[^.]*\.?/gi, "Consultá el estado actual de la operación antes de actuar.")
    .trim();
}

export function unreadNotificationCount(db: DatabaseSync, accountId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS total FROM notification WHERE account_id=? AND read_at IS NULL").get(accountId) as { total: number };
  return row.total;
}

export function listNotificationsForAccount(
  db: DatabaseSync,
  account: { account_id: string },
): NotificationItem[] {
  const authorizedOperations = new Set(listOperationsForAccount(db, account.account_id).map((op) => op.operation_id));
  const rows = asRows<NotificationRow>(db.prepare(
    `SELECT notification_id, body, operation_id, deadline, read_at, created_at
     FROM notification WHERE account_id=? ORDER BY created_at DESC`,
  ).all(account.account_id));

  return rows.map((row) => {
    const canOpenOperation = Boolean(row.operation_id && authorizedOperations.has(row.operation_id));
    const operation = canOpenOperation
      ? db.prepare("SELECT title, state FROM operation WHERE operation_id=?").get(row.operation_id) as { title: string; state: string } | undefined
      : undefined;
    return {
      notificationId: row.notification_id,
      body: historicalNotificationText(row.body),
      operationId: row.operation_id,
      operationTitle: operation?.title ?? null,
      operationState: operation?.state ?? null,
      operationHref: operation && row.operation_id ? `/operaciones/${row.operation_id}` : null,
      deadline: row.deadline,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  });
}

export function markNotificationRead(db: DatabaseSync, notificationId: string, accountId: string, readAt = new Date().toISOString()): boolean {
  const result = db.prepare(
    "UPDATE notification SET read_at=COALESCE(read_at, ?) WHERE notification_id=? AND account_id=?",
  ).run(readAt, notificationId, accountId);
  return result.changes > 0;
}

export function markAllNotificationsRead(db: DatabaseSync, accountId: string, readAt = new Date().toISOString()): number {
  const result = db.prepare(
    "UPDATE notification SET read_at=? WHERE account_id=? AND read_at IS NULL",
  ).run(readAt, accountId);
  return Number(result.changes);
}
