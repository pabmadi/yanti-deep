import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

process.env.YANTI_DB_PATH = join(mkdtempSync(join(tmpdir(), "yanti-list-test-")), "test.db");

import { getDb, resetDb } from "@/data/db";
import { ensureSeed, DEMO } from "@/data/seed";
import { createOperationDraft, sendOperation, acceptOperation, startPayment } from "@/server/operations";
import { simulateProviderWebhook } from "@/server/provider-fake";
import { listOperationItemsForAccount } from "@/server/operation-list-query";
import { filterOperationItems, groupForOperation, nextStepForOperation, type OperationListItem } from "@/ui/lib/operation-list";

describe("listas diarias de operaciones", () => {
  beforeAll(() => {
    const db = getDb();
    resetDb(db);
    ensureSeed(db);
  });

  it("clasifica la acción según el rol y explica el siguiente paso", () => {
    expect(groupForOperation("AWAITING_ACCEPTANCE", "BUYER")).toBe("action");
    expect(groupForOperation("AWAITING_ACCEPTANCE", "SELLER")).toBe("waiting");
    expect(groupForOperation("PAID_AWAITING_SHIPMENT", "SELLER")).toBe("action");
    expect(groupForOperation("PAID_AWAITING_SHIPMENT", "BUYER")).toBe("waiting");
    expect(groupForOperation("REFUNDED", "BUYER")).toBe("finished");
    expect(nextStepForOperation("SHIPPED_AWAITING_RECEIPT", "BUYER")).toContain("confirmá");
  });

  it("busca sin distinguir mayúsculas por título o código y combina el filtro de grupo", () => {
    const base = {
      operationId: "op_1", supportCode: "YT-AB12", title: "Cámara Fuji", state: "AWAITING_ACCEPTANCE",
      role: "BUYER", counterparty: "Ana", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      deadline: null, deadlineLabel: null, nextStep: "Aceptar", group: "action", amountMinor: 100, currency: "ARS", amountLabel: "Total a pagar",
    } satisfies OperationListItem;
    const finished = { ...base, operationId: "op_2", supportCode: "YT-ZZ99", title: "Bicicleta", state: "COMPLETED", group: "finished" } satisfies OperationListItem;
    expect(filterOperationItems([base, finished], { q: "fuji", group: "all" })).toEqual([base]);
    expect(filterOperationItems([base, finished], { q: "zz99", group: "finished" })).toEqual([finished]);
    expect(filterOperationItems([base, finished], { q: "cámara", group: "finished" })).toEqual([]);
  });

  it("proyecta la contraparte y el monto del acuerdo correcto para cada participante", () => {
    const db = getDb();
    const seller = db.prepare("SELECT * FROM account WHERE email_canonical=?").get(DEMO.SELLER_EMAIL) as { account_id: string; email_canonical: string };
    const buyer = db.prepare("SELECT * FROM account WHERE email_canonical=?").get(DEMO.BUYER_EMAIL) as { account_id: string; email_canonical: string };
    const opId = createOperationDraft(db, {
      sellerId: seller.account_id,
      title: "Cámara para listado",
      description: "Con lente y cargador",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 100_000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, opId, seller.account_id);
    acceptOperation(db, opId, buyer.account_id);

    const buyerItem = listOperationItemsForAccount(db, buyer).find((item) => item.operationId === opId)!;
    const sellerItem = listOperationItemsForAccount(db, seller).find((item) => item.operationId === opId)!;
    expect(buyerItem.counterparty).toContain("Ana");
    expect(buyerItem.amountLabel).toBe("Total a pagar");
    expect(buyerItem.amountMinor).toBe(101_000);
    expect(sellerItem.counterparty).toContain("Leo");
    expect(sellerItem.amountLabel).toBe("Neto a recibir");
    expect(sellerItem.amountMinor).toBe(99_000);
  });

  it("deja de pedir acción cuando el proveedor ya confirmó el pago", () => {
    const db = getDb();
    const seller = db.prepare("SELECT * FROM account WHERE email_canonical=?").get(DEMO.SELLER_EMAIL) as { account_id: string; email_canonical: string };
    const buyer = db.prepare("SELECT * FROM account WHERE email_canonical=?").get(DEMO.BUYER_EMAIL) as { account_id: string; email_canonical: string };
    const opId = createOperationDraft(db, {
      sellerId: seller.account_id, title: "Pago contextual", description: "Prueba", countryCode: "AR",
      currency: "ARS", baseAmountMinor: 50_000, categoryCode: "GENERAL", buyerEmail: DEMO.BUYER_EMAIL,
    });
    sendOperation(db, opId, seller.account_id);
    acceptOperation(db, opId, buyer.account_id);
    const payment = startPayment(db, opId, buyer.account_id, "list-payment-context");
    expect(listOperationItemsForAccount(db, buyer).find((item) => item.operationId === opId)?.group).toBe("action");

    simulateProviderWebhook(db, payment.attemptId, "SUCCESS");
    const pendingReconciliation = listOperationItemsForAccount(db, buyer).find((item) => item.operationId === opId)!;
    expect(pendingReconciliation.group).toBe("waiting");
    expect(pendingReconciliation.nextStep).toBe("Yanti está confirmando tu pago.");
  });
});
