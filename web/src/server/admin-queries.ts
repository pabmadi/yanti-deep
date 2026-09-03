/**
 * Read models de la consola admin: listados autorizados para el panel.
 * Toda función aquí se invoca después del guard currentAdmin()/requireAdmin().
 */
import type { DatabaseSync } from "node:sqlite";
import { asRows, asRow } from "@/data/db";
import type { AccountRow } from "@/data/repos/account-repo";
import type { CountryRow, CategoryRow } from "@/data/repos/catalog-repo";
import type { FeePolicyRow } from "@/data/repos/policy-repo";
import type { SettingRow } from "@/data/repos/setting-repo";

/* ------------------------------------------------------------------ */
/* Usuarios                                                            */
/* ------------------------------------------------------------------ */
export interface AdminUserRow {
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
  ops_count: number;
}

export function listUsers(db: DatabaseSync, opts: { q?: string; status?: string; limit?: number } = {}): AdminUserRow[] {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (opts.q?.trim()) {
    where.push("(display_name LIKE ? OR email_canonical LIKE ?)");
    const like = `%${opts.q.trim()}%`;
    params.push(like, like);
  }
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  const limit = Math.min(opts.limit ?? 100, 500);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return asRows<AdminUserRow>(
    db
      .prepare(
        `SELECT a.*, (SELECT COUNT(*) FROM operation_party op WHERE op.account_id = a.account_id) AS ops_count
         FROM account a ${clause} ORDER BY a.created_at DESC LIMIT ?`,
      )
      .all(...params, limit),
  );
}

export interface AdminUserDetail {
  account: AccountRow;
  ops_count: number;
  as_buyer: number;
  as_seller: number;
  disputes_opened: number;
  disputes_involved: number;
  ratings_received: number;
}

export function getUserDetail(db: DatabaseSync, accountId: string): AdminUserDetail | undefined {
  const account = asRow<AccountRow | undefined>(db.prepare("SELECT * FROM account WHERE account_id=?").get(accountId));
  if (!account) return undefined;
  const ops = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM operation_party WHERE account_id=?) AS party,
         (SELECT COUNT(*) FROM operation_party WHERE account_id=? AND role='BUYER') AS buyer,
         (SELECT COUNT(*) FROM operation_party WHERE account_id=? AND role='SELLER') AS seller,
         (SELECT COUNT(*) FROM dispute WHERE opened_by=?) AS disputes_opened,
         (SELECT COUNT(*) FROM operation o JOIN operation_party op ON op.operation_id=o.operation_id
            JOIN dispute d ON d.operation_id=o.operation_id WHERE op.account_id=?) AS disputes_involved,
         (SELECT COUNT(*) FROM rating WHERE target_id=?) AS ratings`,
    )
    .get(accountId, accountId, accountId, accountId, accountId, accountId) as {
    party: number;
    buyer: number;
    seller: number;
    disputes_opened: number;
    disputes_involved: number;
    ratings: number;
  };
  return {
    account,
    ops_count: ops.party,
    as_buyer: ops.buyer,
    as_seller: ops.seller,
    disputes_opened: ops.disputes_opened,
    disputes_involved: ops.disputes_involved,
    ratings_received: ops.ratings,
  };
}

/* ------------------------------------------------------------------ */
/* Catálogos                                                           */
/* ------------------------------------------------------------------ */
export function listCategoriesAdmin(db: DatabaseSync): CategoryRow[] {
  return asRows<CategoryRow>(db.prepare("SELECT * FROM category_catalog ORDER BY label_es ASC").all());
}

export function listCountriesAdmin(db: DatabaseSync): CountryRow[] {
  return asRows<CountryRow>(db.prepare("SELECT * FROM country_catalog ORDER BY name_es ASC").all());
}

/* ------------------------------------------------------------------ */
/* Políticas de comisión                                               */
/* ------------------------------------------------------------------ */
export function listFeePolicies(db: DatabaseSync): FeePolicyRow[] {
  return asRows<FeePolicyRow>(
    db.prepare("SELECT * FROM fee_policy_version ORDER BY effective_from DESC, version DESC LIMIT 200").all(),
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
export function listSettingsAdmin(db: DatabaseSync): SettingRow[] {
  return db.prepare("SELECT * FROM admin_setting ORDER BY setting_key ASC").all() as unknown as SettingRow[];
}

/* ------------------------------------------------------------------ */
/* Devoluciones activas (admin)                                        */
/* ------------------------------------------------------------------ */
export interface ReturnAdminRow {
  return_id: string;
  operation_id: string;
  support_code: string;
  title: string;
  state: string;
  deadline: string | null;
  created_at: string;
}

export function listActiveReturnsAdmin(db: DatabaseSync): ReturnAdminRow[] {
  return asRows<ReturnAdminRow>(
    db
      .prepare(
        `SELECT rc.return_id, rc.operation_id, o.support_code, o.title, rc.state, rc.deadline, rc.created_at
         FROM return_case rc JOIN operation o ON o.operation_id = rc.operation_id
         WHERE rc.state IN ('INSTRUCTIONS_ISSUED','PREPARING','DISPATCHED','IN_TRANSIT')
         ORDER BY rc.created_at ASC`,
      )
      .all(),
  );
}
