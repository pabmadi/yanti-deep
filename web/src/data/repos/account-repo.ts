import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "../ids";
import type { OperationState } from "@/domain/state-machines";
import type { DomainError } from "@/domain/errors";
import { errVersion } from "@/domain/errors";

export interface AccountRow {
  account_id: string;
  display_name: string;
  email_canonical: string;
  locale: string;
  country: string | null;
  timezone: string;
  status: string;
  is_admin: number;
  created_at: string;
  updated_at: string;
  version: number;
}

export function getAccountByEmail(db: DatabaseSync, email: string): AccountRow | undefined {
  return db.prepare("SELECT * FROM account WHERE email_canonical = ?").get(email) as AccountRow | undefined;
}

export function getAccount(db: DatabaseSync, accountId: string): AccountRow | undefined {
  return db.prepare("SELECT * FROM account WHERE account_id = ?").get(accountId) as AccountRow | undefined;
}

export function createAccount(
  db: DatabaseSync,
  a: {
    accountId: string;
    displayName: string;
    email: string;
    locale?: string;
    country?: string;
    timezone?: string;
    isAdmin?: boolean;
  },
): AccountRow {
  const now = nowIso();
  db.prepare(
    `INSERT INTO account (account_id, display_name, email_canonical, locale, country, timezone, status, is_admin, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 1)`,
  ).run(
    a.accountId,
    a.displayName,
    a.email.toLowerCase(),
    a.locale ?? "es",
    a.country ?? null,
    a.timezone ?? "UTC",
    a.isAdmin ? 1 : 0,
    now,
    now,
  );
  return getAccount(db, a.accountId)!;
}

export function updateAccountProfile(
  db: DatabaseSync,
  accountId: string,
  patch: { displayName?: string; locale?: string; country?: string; timezone?: string },
  expectedVersion: number,
): AccountRow {
  const cur = getAccount(db, accountId);
  if (!cur) throw errVersion();
  if (cur.version !== expectedVersion) throw errVersion();
  const next = {
    displayName: patch.displayName ?? cur.display_name,
    locale: patch.locale ?? cur.locale,
    country: patch.country !== undefined ? patch.country : cur.country,
    timezone: patch.timezone ?? cur.timezone,
    version: cur.version + 1,
    updatedAt: nowIso(),
  };
  db.prepare(
    `UPDATE account SET display_name=?, locale=?, country=?, timezone=?, version=?, updated_at=? WHERE account_id=?`,
  ).run(next.displayName, next.locale, next.country, next.timezone, next.version, next.updatedAt, accountId);
  return getAccount(db, accountId)!;
}
