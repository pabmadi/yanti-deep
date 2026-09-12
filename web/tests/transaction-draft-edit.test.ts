import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { initSchema } from "@/data/db";
import { ensureSeed, DEMO } from "@/data/seed";
import { getOperation } from "@/data/repos/operation-repo";
import { createOperationDraft, sendOperation, updateOperationDraft } from "@/server/operations";
import { quoteBreakdown } from "@/server/policy";
import { DomainError } from "@/domain/errors";

const testDir = mkdtempSync(join(tmpdir(), "yanti-draft-edit-"));
const db = new DatabaseSync(join(testDir, "draft-edit.db"));

describe("edición segura del borrador", () => {
  let sellerId: string;
  let buyerId: string;

  beforeAll(() => {
    db.exec("PRAGMA foreign_keys = ON");
    initSchema(db);
    ensureSeed(db);
    sellerId = (db.prepare("SELECT account_id FROM account WHERE email_canonical=?").get(DEMO.SELLER_EMAIL) as { account_id: string }).account_id;
    buyerId = (db.prepare("SELECT account_id FROM account WHERE email_canonical=?").get(DEMO.BUYER_EMAIL) as { account_id: string }).account_id;
  });

  afterAll(() => {
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  function makeDraft(): string {
    return createOperationDraft(db, {
      sellerId,
      title: "Cámara usada",
      description: "Incluye lente y batería",
      countryCode: "AR",
      currency: "ARS",
      baseAmountMinor: 100_000,
      categoryCode: "GENERAL",
      buyerEmail: DEMO.BUYER_EMAIL,
    });
  }

  it("actualiza operación y acuerdo con las comisiones recalculadas", () => {
    const operationId = makeDraft();
    const version = getOperation(db, operationId)!.version;
    const expected = quoteBreakdown(db, { countryCode: "AR", currency: "ARS", categoryCode: "GENERAL" }, 250_000);

    const result = updateOperationDraft(db, operationId, sellerId, {
      title: "Cámara usada con lente",
      description: "Incluye lente, batería y cargador",
      baseAmountMinor: 250_000,
      buyerEmail: DEMO.BUYER_EMAIL,
      externalLink: "https://example.com/camara",
      expectedVersion: version,
    });

    expect(result.version).toBe(version + 1);
    expect(getOperation(db, operationId)).toMatchObject({
      title: "Cámara usada con lente",
      base_amount_minor: 250_000,
      version: version + 1,
    });
    const agreement = db.prepare(
      "SELECT base_amount_minor, buyer_fee_minor, seller_fee_minor, buyer_total_minor, seller_net_minor FROM agreement_version WHERE operation_id=? AND version=1",
    ).get(operationId);
    expect(agreement).toMatchObject({
      base_amount_minor: 250_000,
      buyer_fee_minor: expected.buyerFeeMinor,
      seller_fee_minor: expected.sellerFeeMinor,
      buyer_total_minor: expected.buyerTotalMinor,
      seller_net_minor: expected.sellerNetMinor,
    });
  });

  it("rechaza a otro actor y conserva el borrador", () => {
    const operationId = makeDraft();
    const before = getOperation(db, operationId)!;
    expect(() => updateOperationDraft(db, operationId, buyerId, {
      title: "Intento ajeno",
      description: "No debe guardarse",
      baseAmountMinor: 1,
      buyerEmail: DEMO.BUYER_EMAIL,
      expectedVersion: before.version,
    })).toThrowError(DomainError);
    expect(getOperation(db, operationId)).toMatchObject({ title: before.title, base_amount_minor: before.base_amount_minor, version: before.version });
  });

  it("rechaza una versión vencida y un acuerdo ya enviado", () => {
    const operationId = makeDraft();
    const version = getOperation(db, operationId)!.version;
    expect(() => updateOperationDraft(db, operationId, sellerId, {
      title: "Versión vieja",
      description: "No debe guardarse",
      baseAmountMinor: 120_000,
      buyerEmail: DEMO.BUYER_EMAIL,
      expectedVersion: version - 1,
    })).toThrowError(/Versión desactualizada/);

    sendOperation(db, operationId, sellerId);
    const sent = getOperation(db, operationId)!;
    expect(() => updateOperationDraft(db, operationId, sellerId, {
      title: "Edición tardía",
      description: "No debe guardarse",
      baseAmountMinor: 130_000,
      buyerEmail: DEMO.BUYER_EMAIL,
      expectedVersion: sent.version,
    })).toThrowError(/ya fue enviado/);
    expect(getOperation(db, operationId)!.title).toBe("Cámara usada");
  });
});
