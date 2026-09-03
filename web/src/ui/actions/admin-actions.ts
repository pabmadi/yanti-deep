"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAccount, requireAdmin } from "@/ui/lib/session";
import { adminReconcileAndAccredit } from "@/server/provider-fake";
import { proposeResolution, confirmResolution, listOpenDisputes } from "@/server/disputes";
import { simulateProviderWebhook } from "@/server/provider-fake";
import type { ResolutionOutcome } from "@/domain/state-machines";

export async function reconcilePaymentAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  const account = await requireAccount();
  adminReconcileAndAccredit(getDb(), operationId, account.account_id);
  redirect(`/admin?reconciliado=${operationId}`);
}

export async function adminProposeResolutionAction(formData: FormData) {
  const account = await requireAdmin();
  const operationId = String(formData.get("operationId") ?? "");
  const outcome = String(formData.get("outcome") ?? "REFUND_WITHOUT_RETURN") as ResolutionOutcome;
  const rationale = String(formData.get("rationale") ?? "").trim();
  proposeResolution(getDb(), operationId, account.account_id, {
    outcome,
    rationale,
  });
  redirect(`/admin/operaciones/${operationId}?resolucion=1`);
}

export async function adminConfirmResolutionAction(formData: FormData) {
  const account = await requireAdmin();
  const operationId = String(formData.get("operationId") ?? "");
  const resolutionId = String(formData.get("resolutionId") ?? "");
  confirmResolution(getDb(), operationId, account.account_id, resolutionId);
  redirect(`/admin?resuelta=1`);
}

export async function adminSimulateWebhookAction(formData: FormData) {
  const account = await requireAdmin();
  const attemptId = String(formData.get("attemptId") ?? "");
  const mode = String(formData.get("mode") ?? "SUCCESS");
  simulateProviderWebhook(getDb(), attemptId, mode as "SUCCESS");
  const row = getDb().prepare("SELECT operation_id FROM payment_attempt WHERE attempt_id=?").get(attemptId) as { operation_id: string } | undefined;
  redirect(row ? `/admin/operaciones/${row.operation_id}?webhook=1` : "/admin");
}
