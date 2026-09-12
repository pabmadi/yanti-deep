"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAccount } from "@/ui/lib/session";
import {
  createOperationDraft,
  updateOperationDraft,
  sendOperation,
  acceptOperation,
  startPayment,
  cancelOperation,
} from "@/server/operations";
import { submitShipment, confirmReceipt } from "@/server/shipping";
import { openDispute, submitDisputeEvidence } from "@/server/disputes";
import { storeEvidence } from "@/data/repos/evidence-repo";
import { simulateProviderWebhook, processFakeReturn } from "@/server/provider-fake";
import { fromDecimal } from "@/domain/money";
import { DomainError } from "@/domain/errors";
import { createRating } from "@/data/repos/rating-repo";

export interface DraftFormValues {
  titulo: string;
  descripcion: string;
  monto: string;
  categoria: string;
  comprador_email: string;
  enlace: string;
  pais: string;
  moneda: string;
  operationId?: string;
  version?: string;
}

export interface DraftFormState {
  error: string | null;
  values: DraftFormValues;
}

function draftValues(formData: FormData): DraftFormValues {
  return {
    titulo: String(formData.get("titulo") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
    monto: String(formData.get("monto") ?? ""),
    categoria: String(formData.get("categoria") ?? "GENERAL"),
    comprador_email: String(formData.get("comprador_email") ?? ""),
    enlace: String(formData.get("enlace") ?? ""),
    pais: String(formData.get("pais") ?? "AR"),
    moneda: String(formData.get("moneda") ?? "ARS"),
    operationId: String(formData.get("operationId") ?? "") || undefined,
    version: String(formData.get("version") ?? "") || undefined,
  };
}

function formError(error: unknown): string {
  if (error instanceof DomainError) {
    if (error.code === "ERR-CONC-001") return "El borrador cambió en otra ventana. Recargá la página y revisá los últimos datos.";
    if (error.code === "ERR-AUTH-001") return "No pudimos guardar este borrador. Verificá que siga siendo tuyo y esté disponible.";
    return error.message;
  }
  if (error instanceof Error && error.message === "importe inválido") return "Ingresá un monto válido.";
  return "No pudimos guardar la solicitud. Tus datos siguen en el formulario para que vuelvas a intentar.";
}

/** Server action que envuelve un comando y redirige (con reintento de sesión). */
async function withAccount<T>(fn: (accountId: string) => Promise<T> | T): Promise<T> {
  const account = await requireAccount();
  return fn(account.account_id);
}

export async function createDraftAction(_previous: DraftFormState, formData: FormData): Promise<DraftFormState> {
  const values = draftValues(formData);
  let operationId: string;
  try {
    operationId = await withAccount(async (accountId) => {
      const db = getDb();
      const baseDecimal = Number(values.monto);
      const baseMinor = fromDecimal(baseDecimal, values.moneda).amountMinor;
      const createdId = createOperationDraft(db, {
        sellerId: accountId,
        title: values.titulo.trim(),
        description: values.descripcion.trim(),
        countryCode: values.pais,
        currency: values.moneda,
        baseAmountMinor: baseMinor,
        categoryCode: values.categoria,
        buyerEmail: values.comprador_email.trim() || undefined,
        externalLink: values.enlace.trim() || undefined,
      });
      const file = formData.get("imagen");
      if (file instanceof File && file.size > 0) {
        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new DomainError("ERR-VALID-001", "La imagen debe ser válida y pesar hasta 10 MB", 400);
        storeEvidence(db, { operationId: createdId, purpose: "REQUEST_IMAGE", authorId: accountId, file: { originalName: file.name, mimeType: file.type, sizeBytes: file.size, buffer: Buffer.from(await file.arrayBuffer()) } });
      }
      return createdId;
    });
  } catch (error) {
    return { error: formError(error), values };
  }
  redirect(`/operaciones/${operationId}?creada=1`);
}

export async function updateDraftAction(_previous: DraftFormState, formData: FormData): Promise<DraftFormState> {
  const values = draftValues(formData);
  const operationId = values.operationId ?? "";
  try {
    await withAccount((accountId) => {
      const baseMinor = fromDecimal(Number(values.monto), values.moneda).amountMinor;
      updateOperationDraft(getDb(), operationId, accountId, {
        title: values.titulo,
        description: values.descripcion,
        baseAmountMinor: baseMinor,
        buyerEmail: values.comprador_email || undefined,
        externalLink: values.enlace || undefined,
        expectedVersion: Number(values.version),
      });
    });
  } catch (error) {
    return { error: formError(error), values };
  }
  redirect(`/operaciones/${operationId}?actualizada=1`);
}

export async function sendOperationAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount(async (accountId) => {
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
  await withAccount(async (accountId) => {
    const db = getDb();
    submitShipment(db, operationId, accountId, {
      carrier: String(formData.get("transportista") ?? "").trim(),
      trackingCode: String(formData.get("tracking") ?? "").trim(),
      trackingUrl: String(formData.get("tracking_url") ?? "").trim() || undefined,
    });
    const file = formData.get("imagen_envio");
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new DomainError("ERR-VALID-001", "La imagen debe ser válida y pesar hasta 10 MB", 400);
      storeEvidence(db, { operationId, purpose: "SHIPMENT_EVIDENCE", authorId: accountId, file: { originalName: file.name, mimeType: file.type, sizeBytes: file.size, buffer: Buffer.from(await file.arrayBuffer()) } });
    }
  });
  redirect(`/operaciones/${operationId}?despachada=1`);
}

export async function confirmReceiptAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  await withAccount((accountId) => {
    confirmReceipt(getDb(), operationId, accountId, `confirm-${operationId}`);
  });
  redirect(`/operaciones/${operationId}?confirmada=1`);
}

export async function submitRatingAction(formData: FormData) {
  const operationId = String(formData.get("operationId") ?? "");
  const stars = Number(formData.get("stars") ?? 0);
  const comment = String(formData.get("comment") ?? "");
  await withAccount((accountId) => {
    const db = getDb();
    const op = db.prepare("SELECT buyer_id, seller_id FROM operation WHERE operation_id=?").get(operationId) as { buyer_id:string|null; seller_id:string }|undefined;
    if (!op) throw new DomainError("ERR-VALID-001", "Operación inexistente", 404);
    const role = op.buyer_id === accountId ? "BUYER" : op.seller_id === accountId ? "SELLER" : null;
    if (!role) throw new DomainError("ERR-AUTH-001", "No autorizado", 404);
    const targetId = role === "BUYER" ? op.seller_id : op.buyer_id;
    if (!targetId) throw new DomainError("ERR-VALID-001", "La contraparte no está disponible", 400);
    createRating(db, { operationId, authorId: accountId, targetId, role, stars, comment });
  });
  redirect(`/operaciones/${operationId}?calificada=1`);
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
  await withAccount(async (accountId) => {
    const db = getDb();
    const text = String(formData.get("evidencia") ?? "").trim();
    submitDisputeEvidence(db, disputeId, accountId, text || "Imagen adjunta");
    const file = formData.get("imagen");
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new DomainError("ERR-VALID-001", "La imagen debe ser válida y pesar hasta 10 MB", 400);
      const dispute = db.prepare("SELECT operation_id FROM dispute WHERE dispute_id=?").get(disputeId) as { operation_id: string } | undefined;
      if (dispute) storeEvidence(db, { operationId: dispute.operation_id, purpose: "DISPUTE_EVIDENCE", authorId: accountId, file: { originalName: file.name, mimeType: file.type, sizeBytes: file.size, buffer: Buffer.from(await file.arrayBuffer()) } });
    }
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
