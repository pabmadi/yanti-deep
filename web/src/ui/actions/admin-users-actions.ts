"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAdmin } from "@/ui/lib/session";
import { setAccountStatus, type AccountStatus } from "@/server/admin-users";

export async function setAccountStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  const status = String(formData.get("status") ?? "") as AccountStatus;
  const reason = String(formData.get("reason") ?? "").trim();
  setAccountStatus(getDb(), { adminId: admin.account_id, accountId, status, reason });
  redirect(`/admin/usuarios/${accountId}?cambiado=1`);
}
