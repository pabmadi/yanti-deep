/**
 * Consultas (read model) para la UI: detalle canónico de operación, timeline,
 * y la vista de compra/venta según rol. La UI solo muestra; la autorización
 * por recurso se valida aquí en servidor.
 */
import type { DatabaseSync } from "node:sqlite";
import { asRows, asRow } from "@/data/db";
import { getOperation, resolveRoleForOperation, type OperationRow } from "@/data/repos/operation-repo";
import { getLatestAttempt } from "@/data/repos/payment-repo";
import { getFrozenPolicy } from "@/server/policy";
import { getShipment } from "@/data/repos/shipment-repo";
import { getDisputeByOperation } from "@/data/repos/dispute-repo";
import { balancesByAccount } from "@/data/repos/ledger-repo";
import { errAuth } from "@/domain/errors";

export interface OperationDetail {
  operation: OperationRow;
  role: "BUYER" | "SELLER";
  agreement: {
    base_amount_minor: number;
    buyer_fee_minor: number;
    seller_fee_minor: number;
    buyer_total_minor: number;
    seller_net_minor: number;
    currency: string;
    sealed_at: string | null;
    title: string;
    description: string;
  } | null;
  paymentAttempt: {
    attempt_id: string;
    state: string;
    requested_total_minor: number;
    accredited_at: string | null;
  } | null;
  shipment: { state: string; carrier: string | null; tracking_code: string | null; tracking_url: string | null; declared_at: string | null } | null;
  dispute: { dispute_id: string; state: string; reason: string | null } | null;
  timeline: Array<{ event_id: string; label: string; actor_id: string | null; created_at: string; state_to: string | null }>;
  counterPartyName: string | null;
}

/**
 * Rol efectivo del visor: delega en el helper compartido que contempla al comprador
 * invitado por email que aún no aceptó (para que pueda ver y aceptar la solicitud).
 */
function resolveViewerRole(db: DatabaseSync, op: OperationRow, viewerId: string): "BUYER" | "SELLER" | undefined {
  const account = asRow<{ email_canonical: string } | undefined>(
    db.prepare("SELECT email_canonical FROM account WHERE account_id = ?").get(viewerId),
  );
  return resolveRoleForOperation(db, op, viewerId, account?.email_canonical);
}

export function getOperationDetail(db: DatabaseSync, operationId: string, viewerId: string): OperationDetail | null {
  const op = getOperation(db, operationId);
  if (!op) return null;
  const role = resolveViewerRole(db, op, viewerId);
  if (!role) throw errAuth(); // no participante -> 404/403 no enumerativo

  const agreement = asRow<{
    base_amount_minor: number;
    buyer_fee_minor: number;
    seller_fee_minor: number;
    buyer_total_minor: number;
    seller_net_minor: number;
    currency: string;
    sealed_at: string | null;
    title: string;
    description: string;
  } | null>(db.prepare("SELECT base_amount_minor, buyer_fee_minor, seller_fee_minor, buyer_total_minor, seller_net_minor, currency, sealed_at, title, description FROM agreement_version WHERE operation_id=? AND version=1").get(operationId));

  const attempt = getLatestAttempt(db, operationId);
  const shipment = getShipment(db, operationId);
  const dispute = getDisputeByOperation(db, operationId);
  const timeline = asRows<{ event_id: string; label: string; actor_id: string | null; created_at: string; state_to: string | null }>(
    db.prepare("SELECT event_id, label, actor_id, created_at, state_to FROM operation_event WHERE operation_id=? ORDER BY created_at ASC").all(operationId),
  );

  const counterPartyName =
    role === "SELLER"
      ? op.buyer_id
        ? (db.prepare("SELECT display_name FROM account WHERE account_id=?").get(op.buyer_id) as { display_name: string } | undefined)?.display_name ?? null
        : op.buyer_email
      : op.seller_id
        ? (db.prepare("SELECT display_name FROM account WHERE account_id=?").get(op.seller_id) as { display_name: string } | undefined)?.display_name ?? null
        : null;

  return {
    operation: op,
    role,
    agreement,
    paymentAttempt: attempt ? { attempt_id: attempt.attempt_id, state: attempt.state, requested_total_minor: attempt.requested_total_minor, accredited_at: attempt.accredited_at } : null,
    shipment: shipment ? { state: shipment.state, carrier: shipment.carrier, tracking_code: shipment.tracking_code, tracking_url: shipment.tracking_url, declared_at: shipment.declared_at } : null,
    dispute: dispute ? { dispute_id: dispute.dispute_id, state: dispute.state, reason: dispute.reason } : null,
    timeline,
    counterPartyName,
  };
}

export function getLedgerBalances(db: DatabaseSync, operationId: string) {
  return balancesByAccount(db, operationId);
}
