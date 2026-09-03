/**
 * Config simple persistida de parámetros operativos (plazos de negocio).
 * Los casos de uso del dominio LEE con `getSettingNumber(db, key, fallback)`;
 * si la clave no existe se usa el default local (nunca se inventa un valor).
 * No retroactivo: un cambio solo afecta lecturas posteriores; las operaciones
 * existentes conservan su política/plazos congelados.
 */
import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "../ids";
import { asRow } from "../db";
import { recordAudit } from "../infra";

export interface SettingRow {
  setting_key: string;
  value_json: string;
  description: string | null;
  updated_by: string | null;
  reason: string | null;
  updated_at: string;
}

export function getSetting(db: DatabaseSync, key: string): SettingRow | undefined {
  return asRow<SettingRow | undefined>(db.prepare("SELECT * FROM admin_setting WHERE setting_key=?").get(key));
}

export function getSettingNumber(db: DatabaseSync, key: string, fallback: number): number {
  const row = getSetting(db, key);
  if (!row) return fallback;
  try {
    const v = JSON.parse(row.value_json) as unknown;
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

export function listSettings(db: DatabaseSync): SettingRow[] {
  return db
    .prepare("SELECT * FROM admin_setting ORDER BY setting_key ASC")
    .all() as unknown as SettingRow[];
}

export interface UpsertSettingInput {
  key: string;
  value: unknown;
  description?: string;
  updatedBy: string; // admin (account_id)
  reason: string; // motivo obligatorio (RF-ADM-009)
}

export function upsertSetting(db: DatabaseSync, input: UpsertSettingInput): SettingRow {
  if (!input.reason.trim()) throw new Error("ERR_VALIDATION: el motivo es obligatorio para cambiar configuración");
  const before = getSetting(db, input.key);
  const now = nowIso();
  db.prepare(
    `INSERT INTO admin_setting (setting_key, value_json, description, updated_by, reason, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET
       value_json=excluded.value_json,
       description=excluded.description,
       updated_by=excluded.updated_by,
       reason=excluded.reason,
       updated_at=excluded.updated_at`,
  ).run(
    input.key,
    JSON.stringify(input.value),
    input.description ?? null,
    input.updatedBy,
    input.reason,
    now,
  );
  recordAudit(db, {
    actorId: input.updatedBy,
    roleEffective: "ADMIN",
    action: "setting.update",
    resourceType: "admin_setting",
    resourceId: input.key,
    reason: input.reason,
    before: before ? JSON.parse(before.value_json) : undefined,
    after: input.value,
  });
  return getSetting(db, input.key)!;
}
