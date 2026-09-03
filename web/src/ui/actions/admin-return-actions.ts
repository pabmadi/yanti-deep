"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAdmin } from "@/ui/lib/session";
import { completeReturnAndRefund } from "@/server/disputes";

export async function adminCompleteReturnAction(formData: FormData) {
  const admin = await requireAdmin();
  const returnId = String(formData.get("returnId") ?? "");
  completeReturnAndRefund(getDb(), returnId, admin.account_id);
  const row = getDb()
    .prepare("SELECT operation_id FROM return_case WHERE return_id=?")
    .get(returnId) as { operation_id: string } | undefined;
  redirect(row ? `/admin/operaciones/${row.operation_id}?devuelta=1` : "/admin?devuelta=1");
}
