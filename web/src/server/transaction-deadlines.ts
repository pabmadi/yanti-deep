import type { DatabaseSync } from "node:sqlite";
import type { OperationRow } from "@/data/repos/operation-repo";
import { getSettingNumber } from "@/data/repos/setting-repo";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CONFIRMATION_GRACE_DAYS = 3;

export interface TransactionDeadlines {
  requestExpiryAt: string | null;
  receiptMilestoneAt: string | null;
  confirmationGraceEndsAt: string | null;
  autoReleaseEnabled: boolean;
}

/** Deriva fechas visibles desde los mismos hitos que usa el tick diario. */
export function computeTransactionDeadlines(
  operation: Pick<OperationRow, "expires_at" | "shipped_at" | "expected_delivery_days">,
  confirmationGraceDays: number,
  autoReleaseEnabled: boolean,
): TransactionDeadlines {
  const shippedTime = operation.shipped_at ? new Date(operation.shipped_at).getTime() : Number.NaN;
  const receiptMilestoneTime = Number.isFinite(shippedTime)
    ? shippedTime + operation.expected_delivery_days * DAY_MS
    : null;
  const graceEndTime = receiptMilestoneTime === null
    ? null
    : receiptMilestoneTime + confirmationGraceDays * DAY_MS;

  return {
    requestExpiryAt: operation.expires_at,
    receiptMilestoneAt: receiptMilestoneTime === null ? null : new Date(receiptMilestoneTime).toISOString(),
    confirmationGraceEndsAt: graceEndTime === null ? null : new Date(graceEndTime).toISOString(),
    autoReleaseEnabled,
  };
}

export function transactionDeadlines(db: DatabaseSync, operation: OperationRow): TransactionDeadlines {
  return computeTransactionDeadlines(
    operation,
    getSettingNumber(db, "confirmation_grace_days", DEFAULT_CONFIRMATION_GRACE_DAYS),
    process.env.YANTI_AUTO_RELEASE === "1",
  );
}
