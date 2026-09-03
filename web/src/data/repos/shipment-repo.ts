import type { DatabaseSync } from "node:sqlite";
import { nowIso, id } from "../ids";
import type { ShipmentState } from "@/domain/state-machines";

export interface ShipmentRow {
  shipment_id: string;
  operation_id: string;
  state: ShipmentState;
  carrier: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  dispatch_date: string | null;
  estimated_delivery_date: string | null;
  declared_at: string | null;
  declared_by: string | null;
}

export function getShipment(db: DatabaseSync, operationId: string): ShipmentRow | undefined {
  return db.prepare("SELECT * FROM shipment WHERE operation_id=?").get(operationId) as ShipmentRow | undefined;
}

export function ensureShipment(db: DatabaseSync, operationId: string): ShipmentRow {
  const existing = getShipment(db, operationId);
  if (existing) return existing;
  const shipmentId = id("shp");
  db.prepare(
    `INSERT INTO shipment (shipment_id, operation_id, state) VALUES (?, ?, 'NOT_STARTED')`,
  ).run(shipmentId, operationId);
  return getShipment(db, operationId)!;
}

export function saveShipmentDraft(
  db: DatabaseSync,
  operationId: string,
  d: { carrier?: string; trackingCode?: string; trackingUrl?: string; dispatchDate?: string; estimatedDelivery?: string },
): ShipmentRow {
  const s = ensureShipment(db, operationId);
  // versionado del tracking: nueva versión si cambia respecto a lo declarado
  const carrier = d.carrier ?? s.carrier ?? null;
  const code = d.trackingCode ?? s.tracking_code ?? null;
  const url = d.trackingUrl ?? s.tracking_url ?? null;
  if ((carrier && carrier !== s.carrier) || (code && code !== s.tracking_code) || (url && url !== s.tracking_url)) {
    const version = db
      .prepare("SELECT COUNT(*) AS c FROM tracking_version WHERE shipment_id=?")
      .get(s.shipment_id) as { c: number };
    db.prepare(
      `INSERT INTO tracking_version (tracking_id, shipment_id, version, carrier, tracking_code, tracking_url, changed_at, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'system')`,
    ).run(id("trk"), s.shipment_id, version.c + 1, carrier, code, url, nowIso());
  }
  db.prepare(
    `UPDATE shipment SET carrier=?, tracking_code=?, tracking_url=?, dispatch_date=?, estimated_delivery_date=?, state='DRAFT' WHERE shipment_id=?`,
  ).run(carrier, code, url, d.dispatchDate ?? s.dispatch_date ?? null, d.estimatedDelivery ?? s.estimated_delivery_date ?? null, s.shipment_id);
  return getShipment(db, operationId)!;
}

export function declareShipment(
  db: DatabaseSync,
  operationId: string,
  declaredBy: string,
): ShipmentRow {
  const s = ensureShipment(db, operationId);
  if (!s.tracking_code && !s.carrier) {
    throw new Error("shipment: se requiere carrier y tracking para declarar");
  }
  const now = nowIso();
  db.prepare(
    `UPDATE shipment SET state='DECLARED', declared_at=?, declared_by=?, dispatch_date=COALESCE(dispatch_date, ?) WHERE shipment_id=?`,
  ).run(now, declaredBy, now, s.shipment_id);
  return getShipment(db, operationId)!;
}
