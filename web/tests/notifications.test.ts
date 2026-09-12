import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

process.env.YANTI_DB_PATH = join(mkdtempSync(join(tmpdir(), "yanti-notifications-test-")), "test.db");

import { getDb } from "@/data/db";
import { ensureSeed, DEMO } from "@/data/seed";
import {
  historicalNotificationText,
  listNotificationsForAccount,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "@/server/notifications";

describe("centro de notificaciones", () => {
  let seller: { account_id: string };
  let buyer: { account_id: string };

  beforeAll(() => {
    const db = getDb();
    ensureSeed(db);
    seller = db.prepare("SELECT account_id FROM account WHERE email_canonical=?").get(DEMO.SELLER_EMAIL) as { account_id: string };
    buyer = db.prepare("SELECT account_id FROM account WHERE email_canonical=?").get(DEMO.BUYER_EMAIL) as { account_id: string };
    const insert = db.prepare(
      `INSERT INTO notification (notification_id, account_id, event_type, body, action_required, created_at)
       VALUES (?, ?, 'test.event', ?, 1, ?)`,
    );
    insert.run("notif_seller_1", seller.account_id, "Aviso de la vendedora", "2026-09-09T12:00:00.000Z");
    insert.run("notif_seller_2", seller.account_id, "Segundo aviso", "2026-09-09T13:00:00.000Z");
    insert.run("notif_buyer_1", buyer.account_id, "Aviso del comprador", "2026-09-09T14:00:00.000Z");
  });

  it("lista y cuenta únicamente las notificaciones de la cuenta actual", () => {
    const db = getDb();
    expect(listNotificationsForAccount(db, seller).map((item) => item.notificationId)).toEqual(["notif_seller_2", "notif_seller_1"]);
    expect(unreadNotificationCount(db, seller.account_id)).toBe(2);
    expect(unreadNotificationCount(db, buyer.account_id)).toBe(1);
  });

  it("no permite marcar como leída una notificación ajena", () => {
    const db = getDb();
    expect(markNotificationRead(db, "notif_buyer_1", seller.account_id, "2026-09-09T15:00:00.000Z")).toBe(false);
    expect(unreadNotificationCount(db, buyer.account_id)).toBe(1);
  });

  it("marca una o todas como leídas sin afectar a otra cuenta", () => {
    const db = getDb();
    expect(markNotificationRead(db, "notif_seller_1", seller.account_id, "2026-09-09T15:00:00.000Z")).toBe(true);
    expect(unreadNotificationCount(db, seller.account_id)).toBe(1);
    expect(markAllNotificationsRead(db, seller.account_id, "2026-09-09T16:00:00.000Z")).toBe(1);
    expect(unreadNotificationCount(db, seller.account_id)).toBe(0);
    expect(unreadNotificationCount(db, buyer.account_id)).toBe(1);
  });

  it("quita promesas automáticas de recordatorios históricos", () => {
    const text = historicalNotificationText("Recordatorio. La liberación automática está prevista mañana.");
    expect(text).not.toContain("liberación automática");
    expect(text).toContain("estado actual");
  });
});
