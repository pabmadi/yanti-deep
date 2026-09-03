/**
 * Motor local de vencimientos y automatizaciones (AU-* del FSD §20).
 * En R00-R02 el "worker" es un tick in-process con reloj inyectable. Cada tarea
 * relee el estado vigente antes de actuar (RF-CON-007, RN-021) y es idempotente.
 */
import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "@/data/ids";
import { listOperationsByState, getActiveHolds } from "@/data/repos/operation-repo";
import { executeRelease } from "./shipping";
import { pushOperationEvent, recordAudit, createNotification } from "@/data/infra";
import { listDisputesByState } from "@/data/repos/dispute-repo";
import { getLatestAttempt } from "@/data/repos/payment-repo";
import { getSettingNumber } from "@/data/repos/setting-repo";

const DEFAULT_CONFIRMATION_GRACE_DAYS = 3;

/**
 * Corre el barrido de vencimientos. Políticas locales de prueba:
 * - solicitud sin pagar expira a los 7 días (configurable)
 * - recordatorios: 1 diario hasta 3 días después del hito de confirmación
 * - liberación automática SOLO si la política local de prueba la habilita
 *   (flag YANTI_AUTO_RELEASE=1; por defecto NO, para respetar DP-021 fail-closed).
 */
export function runDeadlineTick(db: DatabaseSync, opts: { now?: Date; autoReleaseEnabled?: boolean } = {}): { expired: number; reminded: number; released: number } {
  const now = opts.now ?? new Date();
  const iso = now.toISOString();
  let expired = 0;
  let reminded = 0;
  let released = 0;
  const autoRelease = opts.autoReleaseEnabled ?? process.env.YANTI_AUTO_RELEASE === "1";
  const graceDays = getSettingNumber(db, "confirmation_grace_days", DEFAULT_CONFIRMATION_GRACE_DAYS);

  // 1) Expirar solicitudes no pagadas (AWAITING_ACCEPTANCE / ACCEPTED_AWAITING_PAYMENT) vencidas.
  const awaiting = [...listOperationsByState(db, ["AWAITING_ACCEPTANCE", "ACCEPTED_AWAITING_PAYMENT"])];
  for (const op of awaiting) {
    if (op.expires_at && new Date(op.expires_at).getTime() <= now.getTime()) {
      db.prepare("UPDATE operation SET state='EXPIRED', state_reason='Solicitud vencida', updated_at=? WHERE operation_id=?").run(iso, op.operation_id);
      pushOperationEvent(db, { operationId: op.operation_id, actorId: "system", eventType: "operation.expired", label: "Solicitud expirada", stateFrom: op.state, stateTo: "EXPIRED" });
      expired++;
    }
  }

  // 2) Recordatorios de confirmación en operaciones enviadas, pasado el hito de entrega.
  //    (hito = shipped_at + expected_delivery_days; se modela el recordatorio diario hasta 3 días)
  const shipped = [...listOperationsByState(db, ["SHIPPED_AWAITING_RECEIPT"])];
  for (const op of shipped) {
    const hito = op.shipped_at ? new Date(new Date(op.shipped_at).getTime() + (op.expected_delivery_days ?? 10) * 24 * 60 * 60 * 1000) : null;
    if (hito && hito.getTime() <= now.getTime()) {
      const daysOverdue = Math.floor((now.getTime() - hito.getTime()) / (24 * 60 * 60 * 1000));
      if (daysOverdue >= 0 && daysOverdue < graceDays) {
        // Pasar a CONFIRMATION_OVERDUE (gracia) la primera vez, luego recordar.
        if (op.state === "SHIPPED_AWAITING_RECEIPT") {
          db.prepare("UPDATE operation SET state='CONFIRMATION_OVERDUE', updated_at=? WHERE operation_id=?").run(iso, op.operation_id);
          pushOperationEvent(db, { operationId: op.operation_id, actorId: "system", eventType: "confirmation.overdue", label: "Confirmación vencida: se requiere confirmar o reclamar", stateFrom: op.state, stateTo: "CONFIRMATION_OVERDUE" });
        }
        // Notificación diaria (dedup por día aproximado: solo si no se notificó hoy)
        const notifiedToday = db
          .prepare("SELECT COUNT(*) AS c FROM notification WHERE operation_id=? AND event_type='reminder.sent' AND created_at > ?")
          .get(op.operation_id, new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()) as { c: number };
        if (notifiedToday.c === 0 && op.buyer_id) {
          createNotification(db, { accountId: op.buyer_id, operationId: op.operation_id, eventType: "reminder.sent", body: "Recordatorio: confirma la recepción o abre un reclamo. La liberación automática está prevista al vencer la gracia.", actionRequired: true });
          reminded++;
        }
      }
    }
  }

  // 3) Liberación automática al vencer la gracia, SI está habilitada por política local.
  if (autoRelease) {
    const overdue = [...listOperationsByState(db, ["CONFIRMATION_OVERDUE"])];
    for (const op of overdue) {
      const shippedAt = op.shipped_at ?? op.updated_at;
      const graceEnd = new Date(new Date(shippedAt).getTime() + ((op.expected_delivery_days ?? 10) + graceDays) * 24 * 60 * 60 * 1000);
      const holds = getActiveHolds(db, op.operation_id);
      const hasReleaseBlock = holds.some((h) => (JSON.parse(h.blocked_actions) as string[]).includes("LIBERAR"));
      if (graceEnd.getTime() <= now.getTime() && !hasReleaseBlock) {
        try {
          executeRelease(db, op.operation_id, "auto_expiry", "vencimiento de gracia sin reclamo");
          released++;
        } catch {
          // si no es elegible, se deja para revisión
        }
      }
    }
  }

  return { expired, reminded, released };
}
