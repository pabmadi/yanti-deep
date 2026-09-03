/**
 * Infraestructura transaccional local: outbox, auditoría, timeline de operación,
 * notificaciones in-app y envío de correos vía buzón fake.
 * Todo efecto "externo" (email) sale por outbox tras el commit del cambio de dominio.
 */
import type { DatabaseSync } from "node:sqlite";
import { id, nowIso } from "./ids";

export interface AuditInput {
  actorId: string | null;
  roleEffective?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  correlationId?: string;
}

export function recordAudit(db: DatabaseSync, a: AuditInput): void {
  db.prepare(
    `INSERT INTO audit_record (audit_id, actor_id, role_effective, action, resource_type, resource_id, result, reason, before_json, after_json, correlation_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?, ?, ?)`,
  ).run(
    id("aud"),
    a.actorId,
    a.roleEffective ?? null,
    a.action,
    a.resourceType,
    a.resourceId,
    a.reason ?? null,
    a.before !== undefined ? JSON.stringify(a.before) : null,
    a.after !== undefined ? JSON.stringify(a.after) : null,
    a.correlationId ?? null,
    nowIso(),
  );
}

export function enqueueOutbox(
  db: DatabaseSync,
  e: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload?: unknown;
    correlationId?: string;
  },
): void {
  db.prepare(
    `INSERT INTO outbox (outbox_id, aggregate_type, aggregate_id, event_type, payload_json, correlation_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
  ).run(
    id("obx"),
    e.aggregateType,
    e.aggregateId,
    e.eventType,
    e.payload !== undefined ? JSON.stringify(e.payload) : "{}",
    e.correlationId ?? null,
    nowIso(),
  );
}

export function pushOperationEvent(
  db: DatabaseSync,
  e: {
    operationId: string;
    actorId?: string | null;
    eventType: string;
    label: string;
    stateFrom?: string;
    stateTo?: string;
    metadata?: unknown;
  },
): void {
  db.prepare(
    `INSERT INTO operation_event (event_id, operation_id, actor_id, event_type, label, state_from, state_to, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id("evt"),
    e.operationId,
    e.actorId ?? null,
    e.eventType,
    e.label,
    e.stateFrom ?? null,
    e.stateTo ?? null,
    e.metadata !== undefined ? JSON.stringify(e.metadata) : null,
    nowIso(),
  );
}

export function createNotification(
  db: DatabaseSync,
  n: {
    accountId: string;
    operationId?: string;
    eventType: string;
    body: string;
    actionRequired?: boolean;
    deadline?: string;
  },
): void {
  db.prepare(
    `INSERT INTO notification (notification_id, account_id, operation_id, event_type, body, action_required, deadline, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id("ntf"),
    n.accountId,
    n.operationId ?? null,
    n.eventType,
    n.body,
    n.actionRequired ? 1 : 0,
    n.deadline ?? null,
    nowIso(),
  );
}

export interface FakeEmail {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  purpose: string;
  operationId?: string;
}

/** Buzón fake (R00-R02): persiste correos en DB; la UI los muestra en /dev/buzon. */
export function sendEmail(db: DatabaseSync, email: FakeEmail): string {
  const emailId = id("eml");
  db.prepare(
    `INSERT INTO email (email_id, to_email, subject, body_html, body_text, purpose, operation_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    emailId,
    email.toEmail,
    email.subject,
    email.bodyHtml,
    email.bodyText,
    email.purpose,
    email.operationId ?? null,
    nowIso(),
  );
  return emailId;
}
