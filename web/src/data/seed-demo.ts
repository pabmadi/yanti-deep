/**
 * Seed de DEMO-1: crea operaciones de ejemplo en varios estados usando los mismos
 * comandos del dominio, para que la app se vea "viva" al abrirla.
 * `seedHistory` genera además un historial distribuido en meses (backdate de
 * fechas de operación y del ledger) para poblar los charts del dashboard admin.
 * Se ejecuta desde tests (función exportada) o manualmente.
 */
import type { DatabaseSync } from "node:sqlite";
import { ensureSeed, DEMO } from "./seed.ts";
import { requestMagicLink, consumeMagicLink } from "../server/auth.ts";
import {
  createOperationDraft,
  sendOperation,
  acceptOperation,
  startPayment,
} from "../server/operations.ts";
import { simulateProviderWebhook, adminReconcileAndAccredit } from "../server/provider-fake.ts";
import { submitShipment, confirmReceipt, executeRelease, executeRefund } from "../server/shipping.ts";
import { openDispute, proposeResolution, confirmResolution, submitDisputeEvidence } from "../server/disputes.ts";
import { nowIso } from "./ids.ts";

export function accountIdByEmail(db: DatabaseSync, email: string): string {
  const row = db.prepare("SELECT account_id FROM account WHERE email_canonical=?").get(email) as { account_id: string } | undefined;
  if (!row) throw new Error(`cuenta no existe: ${email}`);
  return row.account_id;
}

/** Fecha ISO hace `days` días (para backdate de demo). */
function daysAgoIso(days: number, hourOffset = 0): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - hourOffset * 60 * 60 * 1000).toISOString();
}

/** Crea una operación completa (COMPLETED) con fecha backdateada. */
function completeHistoricalOp(
  db: DatabaseSync,
  n: number,
  sellerId: string,
  buyerId: string,
  adminId: string,
  opts: { title: string; amountMinor: number; carrier: string; tracking: string; daysAgo: number },
): string {
  const at = daysAgoIso(opts.daysAgo);
  const opId = createOperationDraft(db, {
    sellerId,
    title: opts.title,
    description: `Operación histórica de demostración (${opts.daysAgo} días atrás).`,
    countryCode: "AR",
    currency: "ARS",
    baseAmountMinor: opts.amountMinor,
    categoryCode: "GENERAL",
    buyerEmail: DEMO.BUYER_EMAIL,
  });
  sendOperation(db, opId, sellerId);
  acceptOperation(db, opId, buyerId);
  const pay = startPayment(db, opId, buyerId, `hist-pay-${n}`);
  simulateProviderWebhook(db, pay.attemptId, "SUCCESS");
  adminReconcileAndAccredit(db, opId, adminId, { at });
  submitShipment(db, opId, sellerId, { carrier: opts.carrier, trackingCode: opts.tracking });
  // Forzamos fecha de envío en el pasado (la operación quedó creada hoy; ajustamos).
  db.prepare("UPDATE operation SET shipped_at=?, paid_at=?, created_at=?, updated_at=? WHERE operation_id=?").run(
    at,
    at,
    daysAgoIso(opts.daysAgo + 3),
    at,
    opId,
  );
  confirmReceipt(db, opId, buyerId, `hist-confirm-${n}`);
  // confirmReceipt libera y deja COMPLETED con completed_at = hoy; lo backdateamos.
  db.prepare("UPDATE operation SET completed_at=?, updated_at=? WHERE operation_id=?").run(at, at, opId);
  return opId;
}

/** Crea una operación reembolsada (disputa resuelta) con fecha backdateada. */
function refundHistoricalOp(
  db: DatabaseSync,
  n: number,
  sellerId: string,
  buyerId: string,
  adminId: string,
  opts: { title: string; amountMinor: number; daysAgo: number },
): string {
  const at = daysAgoIso(opts.daysAgo);
  const opId = createOperationDraft(db, {
    sellerId,
    title: opts.title,
    description: `Reembolso histórico de demostración (${opts.daysAgo} días atrás).`,
    countryCode: "AR",
    currency: "ARS",
    baseAmountMinor: opts.amountMinor,
    categoryCode: "GENERAL",
    buyerEmail: DEMO.BUYER_EMAIL,
  });
  sendOperation(db, opId, sellerId);
  acceptOperation(db, opId, buyerId);
  const pay = startPayment(db, opId, buyerId, `hist-pay-ref-${n}`);
  simulateProviderWebhook(db, pay.attemptId, "SUCCESS");
  adminReconcileAndAccredit(db, opId, adminId, { at });
  db.prepare("UPDATE operation SET paid_at=?, created_at=?, updated_at=? WHERE operation_id=?").run(
    at,
    daysAgoIso(opts.daysAgo + 3),
    at,
    opId,
  );
  const dispute = openDispute(db, opId, buyerId, { reason: "NOT_RECEIVED", description: "No recibí el producto (demo histórica)." });
  submitDisputeEvidence(db, dispute.disputeId, buyerId, "Seguimiento del correo (demo).");
  submitDisputeEvidence(db, dispute.disputeId, sellerId, "Comprobante de envío (demo).");
  const res = proposeResolution(db, opId, adminId, {
    outcome: "REFUND_WITHOUT_RETURN",
    rationale: "Reembolso de demostración histórica.",
  });
  confirmResolution(db, opId, adminId, res.resolutionId);
  db.prepare("UPDATE operation SET completed_at=?, updated_at=? WHERE operation_id=?").run(at, at, opId);
  return opId;
}

/** Genera historial distribuido en los últimos ~6 meses para poblar métricas. */
export function seedHistory(db: DatabaseSync): number {
  ensureSeed(db);
  const sellerId = accountIdByEmail(db, DEMO.SELLER_EMAIL);
  const buyerId = accountIdByEmail(db, DEMO.BUYER_EMAIL);
  const adminId = accountIdByEmail(db, DEMO.ADMIN_EMAIL);

  const catalog: Array<{ title: string; amountMinor: number; kind: "complete" | "refund"; daysAgo: number }> = [
    // Mes -6
    { title: "Notebook Lenovo ThinkPad", amountMinor: 680000, kind: "complete", daysAgo: 175 },
    { title: "Auriculares Sony WH-1000XM4", amountMinor: 210000, kind: "refund", daysAgo: 170 },
    // Mes -5
    { title: "iPad 9na gen 64GB", amountMinor: 520000, kind: "complete", daysAgo: 148 },
    { title: "Cafetera Nespresso", amountMinor: 130000, kind: "complete", daysAgo: 142 },
    { title: "Bicicleta Venzo R29", amountMinor: 350000, kind: "refund", daysAgo: 138 },
    // Mes -4
    { title: "iPhone 12 128GB", amountMinor: 750000, kind: "complete", daysAgo: 118 },
    { title: "Parlante Sonos One", amountMinor: 190000, kind: "complete", daysAgo: 112 },
    { title: "Kindle Paperwhite", amountMinor: 145000, kind: "complete", daysAgo: 108 },
    // Mes -3
    { title: "Drone DJI Mini 3", amountMinor: 620000, kind: "complete", daysAgo: 88 },
    { title: "Zapatillas Nike Pegasus", amountMinor: 95000, kind: "refund", daysAgo: 82 },
    { title: "Monitor Samsung 32\" 4K", amountMinor: 280000, kind: "complete", daysAgo: 78 },
    // Mes -2
    { title: "PlayStation 5 + juego", amountMinor: 890000, kind: "complete", daysAgo: 58 },
    { title: "Impresora Epson EcoTank", amountMinor: 240000, kind: "complete", daysAgo: 52 },
    // Mes -1
    { title: "MacBook Air M2", amountMinor: 1450000, kind: "complete", daysAgo: 28 },
    { title: "Teclado mecánico Keychron K8", amountMinor: 110000, kind: "refund", daysAgo: 24 },
    { title: "Cámara GoPro Hero 11", amountMinor: 430000, kind: "complete", daysAgo: 18 },
  ];

  let created = 0;
  let n = 1;
  for (const item of catalog) {
    const tracking = `HIST${String(1000 + n)}AR`;
    if (item.kind === "complete") {
      completeHistoricalOp(db, n, sellerId, buyerId, adminId, {
        title: item.title,
        amountMinor: item.amountMinor,
        carrier: n % 2 ? "Andreani" : "OCA",
        tracking,
        daysAgo: item.daysAgo,
      });
    } else {
      refundHistoricalOp(db, n, sellerId, buyerId, adminId, {
        title: item.title,
        amountMinor: item.amountMinor,
        daysAgo: item.daysAgo,
      });
    }
    created++;
    n++;
  }
  return created;
}

export function seedDemoData(db: DatabaseSync): { completedId: string; disputeId: string } {
  ensureSeed(db);
  const sellerId = accountIdByEmail(db, DEMO.SELLER_EMAIL);
  const buyerId = accountIdByEmail(db, DEMO.BUYER_EMAIL);
  const adminId = accountIdByEmail(db, DEMO.ADMIN_EMAIL);

  // Operación 1: ciclo completo COMPLETED
  const op1 = createOperationDraft(db, {
    sellerId,
    title: "Cámara Fuji X-T30 + lente 18-55mm",
    description:
      "Cámara mirrorless en excelente estado. Incluye lente 18-55mm, batería, cargador y correa. Sin rayones en el sensor.",
    countryCode: "AR",
    currency: "ARS",
    baseAmountMinor: 450000,
    categoryCode: "GENERAL",
    buyerEmail: DEMO.BUYER_EMAIL,
  });
  sendOperation(db, op1, sellerId);
  acceptOperation(db, op1, buyerId);
  const pay1 = startPayment(db, op1, buyerId, "demo-pay-1");
  simulateProviderWebhook(db, pay1.attemptId, "SUCCESS");
  adminReconcileAndAccredit(db, op1, adminId);
  submitShipment(db, op1, sellerId, {
    carrier: "Andreani",
    trackingCode: "AR8F7K2L9",
    trackingUrl: "https://www.andreani.com/seguimiento",
  });
  confirmReceipt(db, op1, buyerId, "demo-confirm-1");

  // Operación 2: disputa resuelta con reembolso
  const op2 = createOperationDraft(db, {
    sellerId,
    title: "Parlante Bluetooth JBL Flip 5",
    description: "Parlante portátil, funciona perfecto, batería dura 10 hs. Incluye cable USB-C.",
    countryCode: "AR",
    currency: "ARS",
    baseAmountMinor: 120000,
    categoryCode: "GENERAL",
    buyerEmail: DEMO.BUYER_EMAIL,
  });
  sendOperation(db, op2, sellerId);
  acceptOperation(db, op2, buyerId);
  const pay2 = startPayment(db, op2, buyerId, "demo-pay-2");
  simulateProviderWebhook(db, pay2.attemptId, "SUCCESS");
  adminReconcileAndAccredit(db, op2, adminId);
  submitShipment(db, op2, sellerId, { carrier: "OCA", trackingCode: "OCA99001122" });
  const dispute = openDispute(db, op2, buyerId, {
    reason: "NOT_RECEIVED",
    description: "El seguimiento marca entregado pero nunca recibí el paquete. El transportista dice que lo dejó en otra dirección.",
  });
  submitDisputeEvidence(db, dispute.disputeId, buyerId, "Captura del seguimiento de OCA: figura entregado en 'Av. Siempreviva 742', pero mi domicilio es otro.");
  submitDisputeEvidence(db, dispute.disputeId, sellerId, "Comprobante de envío con la dirección correcta cargada en el sistema. Adjunto captura del despacho.");
  const res2 = proposeResolution(db, op2, adminId, {
    outcome: "REFUND_WITHOUT_RETURN",
    rationale:
      "El tracking no coincide con el domicilio del comprador y no hay constancia fiable de entrega. Se reembolsa el total al comprador y se cierra la operación.",
  });
  confirmResolution(db, op2, adminId, res2.resolutionId);

  // Operación 3: en camino (SHIPPED_AWAITING_RECEIPT) para que el comprador tenga acción pendiente
  const op3 = createOperationDraft(db, {
    sellerId,
    title: "Teclado mecánico Keychron K2",
    description: "Teclado mecánico RGB con switches red. Incluye keycaps extra y cable coiled.",
    countryCode: "AR",
    currency: "ARS",
    baseAmountMinor: 155000,
    categoryCode: "GENERAL",
    buyerEmail: DEMO.BUYER_EMAIL,
  });
  sendOperation(db, op3, sellerId);
  acceptOperation(db, op3, buyerId);
  const pay3 = startPayment(db, op3, buyerId, "demo-pay-3");
  simulateProviderWebhook(db, pay3.attemptId, "SUCCESS");
  adminReconcileAndAccredit(db, op3, adminId);
  submitShipment(db, op3, sellerId, { carrier: "Correo Argentino", trackingCode: "CA123456789AR" });

  // Operación 4: solicitud pendiente de pago (para el vendedor)
  const op4 = createOperationDraft(db, {
    sellerId,
    title: "Monitor LG UltraWide 29\"",
    description: "Monitor 29 pulgadas ultrawide, sin píxeles muertos, con soporte y cables HDMI/DP.",
    countryCode: "AR",
    currency: "ARS",
    baseAmountMinor: 320000,
    categoryCode: "GENERAL",
    buyerEmail: DEMO.BUYER_EMAIL,
  });
  sendOperation(db, op4, sellerId);
  acceptOperation(db, op4, buyerId);

  return { completedId: op1, disputeId: dispute.disputeId };
}
