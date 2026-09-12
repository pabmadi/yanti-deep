"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAccount } from "@/ui/lib/session";
import { registerReturnDispatch } from "@/server/disputes";
import { DomainError } from "@/domain/errors";

export interface ReturnFormState {
  error: string | null;
  carrier: string;
  tracking: string;
}

export async function participantReturnAction(_previous: ReturnFormState, form: FormData): Promise<ReturnFormState> {
  const carrier = String(form.get("carrier") ?? "");
  const tracking = String(form.get("tracking") ?? "");
  const returnId = String(form.get("returnId") ?? "");
  let disputeId: string;
  try {
    const account = await requireAccount();
    const db = getDb();
    // Validate ownership and pending state before any mutation.
    registerReturnDispatch(db, returnId, account.account_id, { carrier, trackingCode: tracking });
    const row = db.prepare(
      "SELECT r.dispute_id FROM return_case c JOIN resolution r ON r.resolution_id=c.resolution_id WHERE c.return_id=?",
    ).get(returnId) as { dispute_id: string };
    disputeId = row.dispute_id;
  } catch (error) {
    return {
      carrier, tracking,
      error: error instanceof DomainError && error.code === "ERR-VALID-001"
        ? error.message
        : "No pudimos registrar la devolución. Conservamos los datos para que revises el estado e intentes de nuevo.",
    };
  }
  redirect(`/disputas/${disputeId}?devolucion=1`);
}
