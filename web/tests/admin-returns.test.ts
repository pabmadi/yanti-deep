/**
 * Devoluciones admin: flujo REQUIRE_RETURN -> buyer registra despacho ->
 * admin confirma recepción (completeReturnAndRefund) -> operación REFUNDED.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const tmpDir = mkdtempSync(join(tmpdir(), "yanti-return-test-"));
process.env.YANTI_DB_PATH = join(tmpDir, "returns.db");

import { getDb, resetDb } from "@/data/db";
import { ensureSeed, DEMO } from "@/data/seed";
import { accountIdByEmail } from "@/data/seed-demo";
import {
  createOperationDraft,
  sendOperation,
  acceptOperation,
  startPayment,
} from "@/server/operations";
import { simulateProviderWebhook, adminReconcileAndAccredit } from "@/server/provider-fake";
import { submitShipment } from "@/server/shipping";
import { openDispute, proposeResolution, confirmResolution, registerReturnDispatch, completeReturnAndRefund } from "@/server/disputes";
import { getOperation } from "@/data/repos/operation-repo";
import { listActiveReturnsAdmin } from "@/server/admin-queries";

describe("Devoluciones admin", () => {
  let db: ReturnType<typeof getDb>;
  let adminId: string;
  let buyerId: string;
  let sellerId: string;

  beforeAll(() => {
    db = getDb();
    resetDb(db);
    ensureSeed(db);
    adminId = accountIdByEmail(db, DEMO.ADMIN_EMAIL);
    buyerId = accountIdByEmail(db, DEMO.BUYER_EMAIL);
    sellerId = accountIdByEmail(db, DEMO.SELLER_EMAIL);
  });

  it("resolución REQUIRE_RETURN crea devolución; admin la completa y reembolsa", () => {
    const opId = createOperationDraft(db, {
      sellerId,
      title: "Artículo con devolución",
      description: "Se exige devolución antes del reembolso.",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 60000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, opId, sellerId);
    acceptOperation(db, opId, buyerId);
    const pay = startPayment(db, opId, buyerId, "return-pay-1");
    simulateProviderWebhook(db, pay.attemptId, "SUCCESS");
    adminReconcileAndAccredit(db, opId, adminId);
    submitShipment(db, opId, sellerId, { carrier: "Andreani", trackingCode: "RET-TRK-1" });

    const dispute = openDispute(db, opId, buyerId, { reason: "DIFFERENT_ITEM", description: "Llegó otro modelo." });
    const res = proposeResolution(db, opId, adminId, { outcome: "REQUIRE_RETURN", rationale: "Se exige devolución.", returnDeadlineDays: 10 });
    confirmResolution(db, opId, adminId, res.resolutionId);
    expect(getOperation(db, opId)!.state).toBe("RETURN_REQUIRED");

    const ret = db.prepare("SELECT * FROM return_case WHERE operation_id=?").get(opId) as { return_id: string; state: string };
    expect(ret.state).toBe("INSTRUCTIONS_ISSUED");
    expect(listActiveReturnsAdmin(db).some((r) => r.return_id === ret.return_id)).toBe(true);

    // Comprador despacha la devolución
    registerReturnDispatch(db, ret.return_id, buyerId, { carrier: "OCA", trackingCode: "RET-CODE-1" });
    // Admin registra recepción conforme -> reembolso
    completeReturnAndRefund(db, ret.return_id, adminId);
    expect(getOperation(db, opId)!.state).toBe("REFUNDED");
    const after = db.prepare("SELECT state FROM return_case WHERE return_id=?").get(ret.return_id) as { state: string };
    expect(after.state).toBe("RECIBIDA_CONFORME");
    const audit = db.prepare("SELECT * FROM audit_record WHERE action='return.complete'").get();
    expect(audit).toBeTruthy();
  });
});
