import type { DatabaseSync } from "node:sqlite";
import { listOperationsForAccount, resolveRoleForOperation } from "@/data/repos/operation-repo";
import type { OperationListItem, ViewerRole } from "@/ui/lib/operation-list";
import { groupForOperation, nextStepForOperation } from "@/ui/lib/operation-list";

interface AgreementAmounts {
  buyer_total_minor: number;
  seller_net_minor: number;
  currency: string;
}

function addDays(iso: string, days: number): string | null {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : new Date(time + days * 86_400_000).toISOString();
}

export function listOperationItemsForAccount(
  db: DatabaseSync,
  account: { account_id: string; email_canonical: string },
): OperationListItem[] {
  return listOperationsForAccount(db, account.account_id).flatMap((op) => {
    const role = resolveRoleForOperation(db, op, account.account_id, account.email_canonical) as ViewerRole | undefined;
    if (!role) return [];

    const agreement = db.prepare(
      `SELECT buyer_total_minor, seller_net_minor, currency
       FROM agreement_version WHERE operation_id=? AND version=1`,
    ).get(op.operation_id) as AgreementAmounts | undefined;
    const counterparty = role === "BUYER"
      ? db.prepare("SELECT display_name FROM account WHERE account_id=?").get(op.seller_id) as { display_name: string } | undefined
      : op.buyer_id
        ? db.prepare("SELECT display_name FROM account WHERE account_id=?").get(op.buyer_id) as { display_name: string } | undefined
        : undefined;
    const returnCase = op.state === "RETURN_REQUIRED"
      ? db.prepare("SELECT state, deadline FROM return_case WHERE operation_id=? ORDER BY created_at DESC LIMIT 1").get(op.operation_id) as { state: string; deadline: string | null } | undefined
      : undefined;
    const paymentAttempt = op.state === "PAYMENT_IN_PROGRESS"
      ? db.prepare("SELECT state FROM payment_attempt WHERE operation_id=? ORDER BY created_at DESC LIMIT 1").get(op.operation_id) as { state: string } | undefined
      : undefined;

    let deadline: string | null = null;
    let deadlineLabel: string | null = null;
    if (["AWAITING_ACCEPTANCE", "ACCEPTED_AWAITING_PAYMENT"].includes(op.state) && op.expires_at) {
      deadline = op.expires_at;
      deadlineLabel = "La solicitud vence";
    } else if (["SHIPPED_AWAITING_RECEIPT", "CONFIRMATION_OVERDUE"].includes(op.state) && op.shipped_at) {
      deadline = addDays(op.shipped_at, op.expected_delivery_days);
      deadlineLabel = "Fecha estimada para confirmar";
    } else if (returnCase?.deadline && !["DISPATCHED", "IN_TRANSIT", "RECIBIDA_CONFORME"].includes(returnCase.state)) {
      deadline = returnCase.deadline;
      deadlineLabel = "La devolución vence";
    }

    const hasAgreement = Boolean(agreement);
    let group = groupForOperation(op.state, role);
    let nextStep = nextStepForOperation(op.state, role);
    if (role === "BUYER" && op.state === "PAYMENT_IN_PROGRESS" && paymentAttempt?.state !== "PENDING_USER_PROVIDER") {
      group = "waiting";
      nextStep = "Yanti está confirmando tu pago.";
    }
    if (role === "BUYER" && op.state === "RETURN_REQUIRED" && returnCase && ["DISPATCHED", "IN_TRANSIT", "RECIBIDA_CONFORME"].includes(returnCase.state)) {
      group = "waiting";
      nextStep = returnCase.state === "RECIBIDA_CONFORME" ? "Yanti está procesando el reembolso." : "El vendedor debe recibir y validar la devolución.";
    }
    const isFinished = ["COMPLETED", "REFUNDED", "CANCELLED", "EXPIRED"].includes(op.state);
    const buyerAlreadyPaid = [
      "PAID_AWAITING_SHIPMENT", "SHIPPED_AWAITING_RECEIPT", "CONFIRMATION_OVERDUE",
      "IN_DISPUTE", "RETURN_REQUIRED", "RELEASE_IN_PROGRESS", "REFUND_IN_PROGRESS",
    ].includes(op.state);
    return [{
      operationId: op.operation_id,
      supportCode: op.support_code,
      title: op.title,
      state: op.state,
      role,
      counterparty: role === "SELLER" ? counterparty?.display_name ?? op.buyer_email : counterparty?.display_name ?? null,
      createdAt: op.created_at,
      updatedAt: op.updated_at,
      deadline,
      deadlineLabel,
      nextStep,
      group,
      amountMinor: hasAgreement
        ? role === "BUYER" ? agreement!.buyer_total_minor : agreement!.seller_net_minor
        : op.base_amount_minor,
      currency: agreement?.currency ?? op.currency,
      amountLabel: hasAgreement
        ? isFinished
          ? role === "BUYER" ? "Total acordado" : "Neto acordado"
          : role === "BUYER" ? buyerAlreadyPaid ? "Total pagado" : "Total a pagar" : op.state === "REFUND_IN_PROGRESS" ? "Neto acordado" : "Neto a recibir"
        : "Monto base",
    }];
  });
}
