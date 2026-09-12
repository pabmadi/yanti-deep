"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAccount } from "@/ui/lib/session";
import { markAllNotificationsRead, markNotificationRead } from "@/server/notifications";

export async function markNotificationReadAction(formData: FormData) {
  const account = await requireAccount();
  const notificationId = String(formData.get("notificationId") ?? "");
  if (notificationId) markNotificationRead(getDb(), notificationId, account.account_id);
  redirect("/notificaciones");
}

export async function markAllNotificationsReadAction(_formData: FormData) {
  const account = await requireAccount();
  markAllNotificationsRead(getDb(), account.account_id);
  redirect("/notificaciones");
}
