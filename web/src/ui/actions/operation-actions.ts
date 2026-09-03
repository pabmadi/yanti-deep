"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAccount } from "@/ui/lib/session";
import {
  createOperationDraft,
  sendOperation,
  acceptOperation,
  startPayment,
  cancelOperation,
} from "@/server/operations";
import { submitShipment, confirmReceipt } from "@/server/shipping";
import { openDispute, submitDisputeEvidence } from "@/server/disputes";
import { simulateProviderWebhook, processFakeReturn } from "@/server/provider-fake";
import { fromDecimal } from "@/domain/money";

/** Server action que envuelve un comando y redirige (con reintento de sesión). */
async function withAccount<T>(fn: (accountId: string) => Promise<T> | T): Promise<T> {
  const account = await requireAccount();
  return fn(account.account_id);
}

export async function createDraftAction(formData: FormData) {
  await withAccount(async (accountId) => {
    const db = getDb();
    const baseDecimal = parseFloat(String(formData.get("monto") ?? "0"));
    const baseMinor = fromDecimal(baseDecimal, String(formData.get("moneda") ?? "ARS")).amountMinor;
    createOperationDraft(db, {
      sellerId: accountId,
      title: String(formData.get("titulo") ?? "").trim(),
      description: String(formData.get("descripcion") ?? "").trim(),
      countryCode: String(formData.get("pais") ?? "AR"),
      currency: String(formData.get("moneda") ?? "ARS"),
      baseAmountMinor: baseMinor,
      categoryCode: String(formData.get("categoria") ?? "GENERAL"),
      buyerEmail: String(formData.get("comprador_email") ?? "").trim() || undefined,
      externalLink: String(formData.get("enlace") ?? "").trim() || undefined,
    });
  });
  redirect("/inicio?creada=1");
}

export async function sendOperationAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount((accountId) => {
    sendOperation(getDb(), operationId, accountId);
  });
  redirect(`/operaciones/${operationId}?enviada=1`);
}

export async function cancelOperationAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount((accountId) => {
    cancelOperation(getDb(), operationId, accountId, "Cancelada por el vendedor");
  });
  redirect(`/mis-ventas`);
}

export async function acceptOperationAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount((accountId) => {
    acceptOperation(getDb(), operationId, accountId);
  });
  redirect(`/operaciones/${operationId}?aceptada=1`);
}

export async function payAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  const result = await withAccount((accountId) => {
    return startPayment(getDb(), operationId, accountId, `ui-${Date.now()}`);
  });
  redirect(`/pagar/fake?attempt=${result.attemptId}`);
}

export async function simulateWebhookAction(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const mode = String(formData.get("mode") ?? "SUCCESS");
  const db = getDb();
  simulateProviderWebhook(db, attemptId, mode as "SUCCESS");
  const row = db.prepare("SELECT operation_id FROM payment_attempt WHERE attempt_id=?").get(attemptId) as { operation_id: string } | undefined;
  if (row) redirect(`/operaciones/${row.operation_id}?webhook=1`);
  redirect("/inicio");
}

export async function declareShipmentAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount((accountId) => {
    submitShipment(getDb(), operationId, accountId, {
      carrier: String(formData.get("transportista") ?? "").trim(),
      trackingCode: String(formData.get("tracking") ?? "").trim(),
      trackingUrl: String(formData.get("tracking_url") ?? "").trim() || undefined,
    });
  });
  redirect(`/operaciones/${operationId}?enviada=1`);
}

export async function confirmReceiptAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount((accountId) => {
    confirmReceipt(getDb(), operationId, accountId, `confirm-${operationId}`);
  });
  redirect(`/operaciones/${operationId}?confirmada=1`);
}

export async function openDisputeAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount((accountId) => {
    openDispute(getDb(), operationId, accountId, {
      reason: String(formData.get("motivo") ?? "OTHER") as "OTHER",
      description: String(formData.get("descripcion") ?? "").trim(),
    });
  });
  redirect(`/operaciones/${operationId}?reclamo=1`);
}

export async function addEvidenceAction(formData: FormData) {
  const disputeId = String(formData.get("disputeId") ?? "");
  await withAccount((accountId) => {
    submitDisputeEvidence(getDb(), disputeId, accountId, String(formData.get("evidencia") ?? "").trim());
  });
  redirect(`/disputas/${disputeId}?evidencia=1`);
}

export async function processFakePaymentReturn(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const db = getDb();
  const row = db.prepare("SELECT operation_id, state FROM payment_attempt WHERE attempt_id=?").get(attemptId) as { operation_id: string; state: string } | undefined;
  if (row) {
    processFakeReturn(db, attemptId, "SUCCESS");
    redirect(`/operaciones/${row.operation_id}?pago_verificando=1`);
  }
  redirect("/inicio");
}
