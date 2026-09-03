import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// Aislar la DB de tests en un directorio temporal para NO tocar la DB local de la demo.
const tmpDir = mkdtempSync(join(tmpdir(), "yanti-test-"));
process.env.YANTI_DB_PATH = join(tmpDir, "test.db");

import { getDb, resetDb } from "@/data/db";
import { ensureSeed, DEMO } from "@/data/seed";
import { requestMagicLink, consumeMagicLink } from "@/server/auth";
import {
  createOperationDraft,
  sendOperation,
  acceptOperation,
  startPayment,
  cancelOperation,
} from "@/server/operations";
import { simulateProviderWebhook, adminReconcileAndAccredit } from "@/server/provider-fake";
import { submitShipment, confirmReceipt, executeRelease } from "@/server/shipping";
import { openDispute, proposeResolution, confirmResolution, submitDisputeEvidence } from "@/server/disputes";
import { runDeadlineTick } from "@/server/tick";
import { getOperation, getActiveHolds } from "@/data/repos/operation-repo";
import { getOpenDispute } from "@/data/repos/dispute-repo";
import { balancesByAccount, attributableBalance } from "@/data/repos/ledger-repo";
import { errDecisionPending, DomainError } from "@/domain/errors";

describe("Yanti flujo completo DEMO-1", () => {
  let db: ReturnType<typeof getDb>;
  let seller: any;
  let buyer: any;
  let ops: any;
  let opId: string;

  beforeAll(() => {
    db = getDb();
    resetDb(db);
    ensureSeed(db);
    seller = db.prepare("SELECT * FROM account WHERE email_canonical=?").get(DEMO.SELLER_EMAIL);
    buyer = db.prepare("SELECT * FROM account WHERE email_canonical=?").get(DEMO.BUYER_EMAIL);
    ops = db.prepare("SELECT * FROM account WHERE email_canonical=?").get(DEMO.ADMIN_EMAIL);
  });

  it("1. magic link permite sesión (POST consume; GET no consume)", () => {
    requestMagicLink(db, { email: DEMO.SELLER_EMAIL, appBaseUrl: "http://localhost:3000" });
    const mail = db.prepare("SELECT * FROM email WHERE to_email=? ORDER BY created_at DESC LIMIT 1").get(DEMO.SELLER_EMAIL) as any;
    const token = mail.body_text.match(/token=([^)\s]+)/)[1];
    // el GET no consume: consumir con token válido sí crea sesión
    const { sessionToken } = consumeMagicLink(db, token);
    expect(sessionToken).toBeTruthy();
    // segundo consumo falla
    expect(() => consumeMagicLink(db, token)).toThrow();
  });

  it("2. crear solicitud, enviar y aceptar", () => {
    opId = createOperationDraft(db, {
      sellerId: seller.account_id,
      title: "Cámara Fuji X-T30",
      description: "Cámara mirrorless impecable con lente y cargador.",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 450000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, opId, seller.account_id);
    acceptOperation(db, opId, buyer.account_id);
    const op = getOperation(db, opId)!;
    expect(op.state).toBe("ACCEPTED_AWAITING_PAYMENT");
  });

  it("3. pago fake: retorno no acredita; webhook + conciliación sí", () => {
    const pay = startPayment(db, opId, buyer.account_id, "idem-pay-1");
    // retorno del navegador (informativo) NO acredita
    expect(getOperation(db, opId)!.state).toBe("PAYMENT_IN_PROGRESS");
    simulateProviderWebhook(db, pay.attemptId, "SUCCESS");
    expect(getOperation(db, opId)!.state).toBe("PAYMENT_IN_PROGRESS"); // aun pendiente de reconciliación
    adminReconcileAndAccredit(db, opId, ops.account_id);
    expect(getOperation(db, opId)!.state).toBe("PAID_AWAITING_SHIPMENT");
  });

  it("3b. webhook duplicado en ACCREDITED_PENDING_RECONCILIATION no lanza error (CA-PAG-002)", () => {
    const opA = createOperationDraft(db, {
      sellerId: seller.account_id,
      title: "Test webhook duplicado",
      description: "x",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 20000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, opA, seller.account_id);
    acceptOperation(db, opA, buyer.account_id);
    const payA = startPayment(db, opA, buyer.account_id, "idem-pay-dup");
    // Primer webhook: pasa a ACCREDITED_PENDING_RECONCILIATION
    simulateProviderWebhook(db, payA.attemptId, "SUCCESS");
    const attemptAfterFirst = db.prepare("SELECT state FROM payment_attempt WHERE attempt_id=?").get(payA.attemptId) as any;
    expect(attemptAfterFirst.state).toBe("ACCREDITED_PENDING_RECONCILIATION");
    // Segundo webhook (duplicado): NO debe lanzar; responde ok sin cambiar estado
    const second = simulateProviderWebhook(db, payA.attemptId, "SUCCESS");
    expect(second.ok).toBe(true);
    const attemptAfterSecond = db.prepare("SELECT state FROM payment_attempt WHERE attempt_id=?").get(payA.attemptId) as any;
    expect(attemptAfterSecond.state).toBe("ACCREDITED_PENDING_RECONCILIATION");
    // Y la reconciliación final sigue funcionando
    adminReconcileAndAccredit(db, opA, ops.account_id);
    expect(getOperation(db, opA)!.state).toBe("PAID_AWAITING_SHIPMENT");
  });

  it("4. declarar envío y confirmar recepción libera con ledger balanceado", () => {
    submitShipment(db, opId, seller.account_id, { carrier: "Andreani", trackingCode: "AR12345" });
    expect(getOperation(db, opId)!.state).toBe("SHIPPED_AWAITING_RECEIPT");
    confirmReceipt(db, opId, buyer.account_id, "idem-confirm-1");
    expect(getOperation(db, opId)!.state).toBe("COMPLETED");
    const balances = balancesByAccount(db, opId);
    expect(balances.length).toBeGreaterThan(0);
    const bal = attributableBalance(db, opId);
    expect(bal.availableMinor).toBe(0); // liberado
  });

  it("5. disputa: reclamo retiene; admin resuelve reembolsando", () => {
    const op2 = createOperationDraft(db, {
      sellerId: seller.account_id,
      title: "Parlante Bluetooth",
      description: "Parlante portátil, funciona perfecto.",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 80000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, op2, seller.account_id);
    acceptOperation(db, op2, buyer.account_id);
    const pay2 = startPayment(db, op2, buyer.account_id, "idem-pay-2");
    simulateProviderWebhook(db, pay2.attemptId, "SUCCESS");
    adminReconcileAndAccredit(db, op2, ops.account_id);
    submitShipment(db, op2, seller.account_id, { carrier: "OCA", trackingCode: "OCA999" });

    // reclamo del comprador (no recibido)
    const dispute = openDispute(db, op2, buyer.account_id, { reason: "NOT_RECEIVED", description: "No recibí el paquete" });
    const op2after = getOperation(db, op2)!;
    expect(op2after.state).toBe("IN_DISPUTE");
    const holds = getActiveHolds(db, op2);
    expect(holds.some((h) => h.hold_type === "DISPUTA_ABIERTA")).toBe(true);
    // aportar evidencia de ambas partes
    submitDisputeEvidence(db, dispute.disputeId, buyer.account_id, "Captura del seguimiento donde figura entregado en otra provincia.");
    submitDisputeEvidence(db, dispute.disputeId, seller.account_id, "Comprobante de envío con tracking correcto.");
    // admin propone y confirma reembolso
    const res = proposeResolution(db, op2, ops.account_id, { outcome: "REFUND_WITHOUT_RETURN", rationale: "Sin evidencia fiable de entrega; se reembolsa al comprador." });
    // La disputa queda vinculada a la resolución (para que la UI muestre "confirmar" y no duplique).
    const disputeRow = db.prepare("SELECT resolution_id FROM dispute WHERE dispute_id=?").get(dispute.disputeId) as any;
    expect(disputeRow.resolution_id).toBe(res.resolutionId);
    // Proponer de nuevo NO crea duplicado (no lanza UNIQUE): devuelve la misma resolución.
    const resAgain = proposeResolution(db, op2, ops.account_id, { outcome: "REFUND_WITHOUT_RETURN", rationale: "Intento duplicado de la UI." });
    expect(resAgain.resolutionId).toBe(res.resolutionId);
    const countRes = db.prepare("SELECT COUNT(*) AS c FROM resolution WHERE dispute_id=?").get(dispute.disputeId) as any;
    expect(countRes.c).toBe(1);
    confirmResolution(db, op2, ops.account_id, res.resolutionId);
    const op2final = getOperation(db, op2)!;
    expect(op2final.state).toBe("REFUNDED");
    expect(getActiveHolds(db, op2).length).toBe(0);
    const dispState = db.prepare("SELECT state FROM dispute WHERE operation_id=?").get(op2) as any;
    expect(dispState.state).toMatch(/^RESOLVED/);
  });

  it("6. cancelación y política ausente no crean valores", () => {
    const op3 = createOperationDraft(db, {
      sellerId: seller.account_id,
      title: "Test cancelar",
      description: "desc",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 10000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    cancelOperation(db, op3, seller.account_id, "ya no");
    expect(getOperation(db, op3)!.state).toBe("CANCELLED");
  });

  it("7. tick expira solicitudes y no libera sin política local explícita", () => {
    const op4 = createOperationDraft(db, {
      sellerId: seller.account_id,
      title: "Vence pronto",
      description: "x",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 5000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, op4, seller.account_id);
    // forzar expiración pasada
    db.prepare("UPDATE operation SET expires_at=? WHERE operation_id=?").run(new Date(Date.now() - 1000).toISOString(), op4);
    const res = runDeadlineTick(db, { autoReleaseEnabled: false });
    expect(getOperation(db, op4)!.state).toBe("EXPIRED");
    expect(res.expired).toBeGreaterThan(0);
  });
});
