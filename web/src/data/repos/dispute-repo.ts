import type { DatabaseSync } from "node:sqlite";
import { nowIso, id } from "../ids";
import { asRow, asRows } from "../db";
import type { DisputeState, ResolutionOutcome, DisputeReason } from "@/domain/state-machines";

export interface DisputeRow {
  dispute_id: string;
  operation_id: string;
  opened_by: string;
  reason: DisputeReason;
  description: string;
  state: DisputeState;
  opened_at: string;
  reviewer_id: string | null;
  resolution_id: string | null;
  resolved_at: string | null;
}

export interface SubmissionRow {
  submission_id: string;
  dispute_id: string;
  author_id: string;
  body: string;
  visibility: string;
  created_at: string;
}

export interface ResolutionRow {
  resolution_id: string;
  dispute_id: string;
  outcome: ResolutionOutcome;
  rationale: string;
  principal_to: string;
  buyer_fee_to: string;
  seller_fee_to: string;
  refund_required: number;
  return_deadline_days: number | null;
  version: number;
  state: "PROPOSED" | "PENDING_SECOND_APPROVAL" | "CONFIRMED";
  author_id: string;
  approver_id: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export function getDispute(db: DatabaseSync, disputeId: string): DisputeRow | undefined {
  return db.prepare("SELECT * FROM dispute WHERE dispute_id=?").get(disputeId) as DisputeRow | undefined;
}

export function getDisputeByOperation(db: DatabaseSync, operationId: string): DisputeRow | undefined {
  return db.prepare("SELECT * FROM dispute WHERE operation_id=? ORDER BY opened_at DESC LIMIT 1").get(operationId) as DisputeRow | undefined;
}

export function getOpenDispute(db: DatabaseSync, operationId: string): DisputeRow | undefined {
  return db
    .prepare(
      `SELECT * FROM dispute WHERE operation_id=? AND state NOT IN ('RESOLVED_RELEASE','RESOLVED_REFUND','RESOLVED_RETURN','RESOLVED_AGREEMENT') ORDER BY opened_at DESC LIMIT 1`,
    )
    .get(operationId) as DisputeRow | undefined;
}

export function listDisputesByState(db: DatabaseSync, states: string[]): DisputeRow[] {
  const marks = states.map(() => "?").join(",");
  return asRows<DisputeRow>(db.prepare(`SELECT * FROM dispute WHERE state IN (${marks}) ORDER BY opened_at ASC`).all(...states));
}

export function createDispute(
  db: DatabaseSync,
  d: { disputeId: string; operationId: string; openedBy: string; reason: DisputeReason; description: string },
): DisputeRow {
  const now = nowIso();
  db.prepare(
    `INSERT INTO dispute (dispute_id, operation_id, opened_by, reason, description, state, opened_at)
     VALUES (?, ?, ?, ?, ?, 'OPEN', ?)`,
  ).run(d.disputeId, d.operationId, d.openedBy, d.reason, d.description, now);
  return getDispute(db, d.disputeId)!;
}

export function updateDisputeState(db: DatabaseSync, disputeId: string, to: DisputeState): DisputeRow {
  const now = nowIso();
  db.prepare(
    `UPDATE dispute SET state=?, resolved_at=CASE WHEN ? IN ('RESOLVED_RELEASE','RESOLVED_REFUND','RESOLVED_RETURN','RESOLVED_AGREEMENT') THEN ? ELSE resolved_at END
     WHERE dispute_id=?`,
  ).run(to, to, now, disputeId);
  return getDispute(db, disputeId)!;
}

export function addSubmission(
  db: DatabaseSync,
  s: { disputeId: string; authorId: string; body: string; visibility?: string },
): SubmissionRow {
  const submissionId = id("sub");
  db.prepare(
    `INSERT INTO dispute_submission (submission_id, dispute_id, author_id, body, visibility, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(submissionId, s.disputeId, s.authorId, s.body, s.visibility ?? "PARTIES", nowIso());
  return asRow<SubmissionRow>(db.prepare("SELECT * FROM dispute_submission WHERE submission_id=?").get(submissionId));
}

export function listSubmissions(db: DatabaseSync, disputeId: string, forParticipant = false): SubmissionRow[] {
  const where = forParticipant ? "AND visibility IN ('PARTIES','SHARED')" : "";
  return asRows<SubmissionRow>(
    db.prepare(`SELECT * FROM dispute_submission WHERE dispute_id=? ${where} ORDER BY created_at ASC`).all(disputeId),
  );
}

/* ------------------------------------------------------------------ */
/* Resoluciones                                                        */
/* ------------------------------------------------------------------ */
export function createResolution(
  db: DatabaseSync,
  r: {
    resolutionId: string;
    disputeId: string;
    outcome: ResolutionOutcome;
    rationale: string;
    principalTo: string;
    buyerFeeTo: string;
    sellerFeeTo: string;
    refundRequired: boolean;
    returnDeadlineDays?: number;
    authorId: string;
  },
): ResolutionRow {
  const now = nowIso();
  db.prepare(
    `INSERT INTO resolution (resolution_id, dispute_id, outcome, rationale, principal_to, buyer_fee_to, seller_fee_to, refund_required, return_deadline_days, version, state, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PROPOSED', ?, ?)`,
  ).run(
    r.resolutionId,
    r.disputeId,
    r.outcome,
    r.rationale,
    r.principalTo,
    r.buyerFeeTo,
    r.sellerFeeTo,
    r.refundRequired ? 1 : 0,
    r.returnDeadlineDays ?? null,
    r.authorId,
    now,
  );
  return getResolution(db, r.resolutionId)!;
}

export function getResolution(db: DatabaseSync, resolutionId: string): ResolutionRow | undefined {
  return db.prepare("SELECT * FROM resolution WHERE resolution_id=?").get(resolutionId) as ResolutionRow | undefined;
}

export function updateResolutionState(
  db: DatabaseSync,
  resolutionId: string,
  state: "PROPOSED" | "PENDING_SECOND_APPROVAL" | "CONFIRMED",
  approverId?: string,
): ResolutionRow {
  const now = nowIso();
  const cur = getResolution(db, resolutionId);
  if (!cur) throw new Error("resolution not found");
  const confirmedAt = state === "CONFIRMED" ? now : null;
  db.prepare(
    `UPDATE resolution SET state=?, approver_id=?, confirmed_at=? WHERE resolution_id=?`,
  ).run(state, approverId ?? cur.approver_id, confirmedAt, resolutionId);
  return getResolution(db, resolutionId)!;
}

export const DISPUTE_STATES_OPEN: string[] = [
  "OPEN",
  "AWAITING_RESPONSE",
  "COLLECTING_EVIDENCE",
  "UNDER_REVIEW",
  "AWAITING_INFORMATION",
  "PROPOSED_RESOLUTION",
  "PENDING_SECOND_APPROVAL",
];
