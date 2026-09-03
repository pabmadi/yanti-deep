/**
 * Simulador de proveedor de pagos (fake determinista, R00-R02). El dominio no depende
 * de SDKs; este adaptador imita a Mercado Pago: crear cobro, webhook de acreditación,
 * retorno del navegador (informativo). Se ejecuta in-process por el "worker" tick.
 */
import type { DatabaseSync } from "node:sqlite";
import { id, nowIso } from "@/data/ids";
import { getAttempt } from "@/data/repos/payment-repo";
import { receiveProviderAccreditation } from "@/server/operations";
import { recordAudit, pushOperationEvent } from "@/data/infra";

/** Estado configurable del fake (para pruebas deterministas). */
export type FakeProviderMode = "SUCCESS" | "REJECT" | "TIMEOUT" | "UNKNOWN" | "DUPLICATE" | "INCONSISTENT";

export function fakeCheckoutRedirect(attemptId: string, mode: FakeProviderMode = "SUCCESS"): string {
  return `/pagar/fake?attempt=${attemptId}&mode=${mode}`;
}

/**
 * Procesa el retorno del navegador del "checkout" fake. NUNCA acredita: es informativo
 * (RF-PAG-002, CA-PAG-001). El pago queda "verificando"; el webhook/consulta acredita.
 */
export function processFakeReturn(
  db: DatabaseSync,
  attemptId: string,
  mode: FakeProviderMode = "SUCCESS",
): { status: "verifying" | "rejected"; message: string } {
  const attempt = getAttempt(db, attemptId);
  if (!attempt) return { status: "rejected", message: "Intento no encontrado" };
  if (attempt.state === "ACCREDITED" || attempt.state === "ACCREDITED_PENDING_RECONCILIATION") {
    return { status: "verifying", message: "Pago verificado" };
  }
  // El retorno del navegador jamás acredita: solo informa.
  if (mode === "REJECT") {
    return { status: "rejected", message: "El pago fue rechazado por el proveedor" };
  }
  return { status: "verifying", message: "Estamos verificando tu pago. Te avisaremos cuando se acredite." };
}

/**
 * Simula el webhook de acreditación del proveedor (o la consulta autoritativa).
 * Con correlación y reconciliación; idempotente. El fake "acredita" usando el monto
 * solicitado (correcto) para que la DEMO-1 avance; en modo INCONSISTENT simula
 * monto distinto (prueba CA-PAG-003).
 */
export function simulateProviderWebhook(
  db: DatabaseSync,
  attemptId: string,
  mode: FakeProviderMode = "SUCCESS",
): { ok: boolean; message: string } {
  const attempt = getAttempt(db, attemptId);
  if (!attempt) return { ok: false, message: "Intento no encontrado" };

  const providerRef = `fakemp_${attempt.attempt_id}`;
  if (mode === "REJECT") {
    recordAudit(db, { actorId: "system", action: "payment.provider_rejected", resourceType: "payment_attempt", resourceId: attemptId });
    return { ok: false, message: "El proveedor rechazó el pago" };
  }
  if (mode === "INCONSISTENT") {
    // Monto distinto al solicitado: no acredita, crea hold.
    try {
      receiveProviderAccreditation(db, attemptId, {
        observedTotalMinor: attempt.requested_total_minor - 1,
        currency: attempt.currency,
        externalAccount: "fake_acct",
        providerRef,
      });
    } catch {
      // ya quedó INCONSISTENT
    }
    return { ok: false, message: "El monto reportado no coincide; la operación quedó en revisión" };
  }
  if (mode === "TIMEOUT" || mode === "UNKNOWN") {
    // Resultado desconocido: nunca acreditar; queda en revisión (prohíbe reintento ciego).
    recordAudit(db, { actorId: "system", action: "payment.result_unknown", resourceType: "payment_attempt", resourceId: attemptId });
    return { ok: false, message: "El proveedor no confirmó el resultado; se requiere verificación manual" };
  }
  if (mode === "DUPLICATE") {
    // Simula doble webhook: la acreditación es idempotente (una sola vez).
  }

  const res = receiveProviderAccreditation(db, attemptId, {
    observedTotalMinor: attempt.requested_total_minor,
    currency: attempt.currency,
    externalAccount: "fake_acct",
    providerRef,
  });
  recordAudit(db, { actorId: "system", action: "payment.webhook", resourceType: "payment_attempt", resourceId: attemptId });
  return { ok: res.ok, message: "Pago acreditado y en proceso de conciliación" };
}

/** Consulta autoritativa (reconciliación admin): ACREDITED_PENDING -> ACREDITED. */
export { reconcileAndAccredit as adminReconcileAndAccredit } from "@/server/operations";
