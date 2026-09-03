/**
 * Administración de usuarios (RF-ADM-006 búsqueda, RF-PER-004 restricción de
 * cuentas). Cambio de estado con motivo obligatorio y auditoría (RF-ADM-009).
 * No permite autodeshabilitarse ni cambiar el propio rol.
 */
import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "@/data/ids";
import { getAccount, type AccountRow } from "@/data/repos/account-repo";
import { recordAudit } from "@/data/infra";
import { errAuth, errValidation } from "@/domain/errors";

export const ACCOUNT_STATUSES = ["ACTIVE", "LIMITED", "SUSPENDED", "BLOCKED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

function requireAdmin(db: DatabaseSync, accountId: string): AccountRow {
  const acc = getAccount(db, accountId);
  if (!acc || !acc.is_admin) throw errAuth();
  return acc;
}

export function setAccountStatus(
  db: DatabaseSync,
  input: { adminId: string; accountId: string; status: AccountStatus; reason: string },
): AccountRow {
  const admin = requireAdmin(db, input.adminId);
  if (admin.account_id === input.accountId) {
    throw errValidation("No podés cambiar tu propio estado de cuenta");
  }
  if (!ACCOUNT_STATUSES.includes(input.status)) throw errValidation("Estado de cuenta inválido");
  if (!input.reason.trim()) throw errValidation("El motivo es obligatorio para cambiar el estado de una cuenta (RF-ADM-009)");

  const target = getAccount(db, input.accountId);
  if (!target) throw errValidation("Cuenta no encontrada");
  if (target.is_admin) {
    throw errValidation("No se puede restringir la cuenta de un administrador por esta vía");
  }

  const before = target.status;
  db.prepare("UPDATE account SET status=?, updated_at=?, version=version+1 WHERE account_id=?").run(
    input.status,
    nowIso(),
    input.accountId,
  );
  recordAudit(db, {
    actorId: input.adminId,
    roleEffective: "ADMIN",
    action: "account.status",
    resourceType: "account",
    resourceId: input.accountId,
    reason: input.reason,
    before: { status: before },
    after: { status: input.status },
  });
  return getAccount(db, input.accountId)!;
}
