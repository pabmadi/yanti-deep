"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAdmin } from "@/ui/lib/session";
import { saveCountry, saveCategory } from "@/server/admin-catalog";

function bool(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "on" || value === "true";
}

function currencies(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function saveCountryAction(formData: FormData) {
  const admin = await requireAdmin();
  saveCountry(getDb(), {
    adminId: admin.account_id,
    code: String(formData.get("code") ?? ""),
    nameEs: String(formData.get("nameEs") ?? ""),
    namePt: (formData.get("namePt") as string) || null,
    currencyCodes: currencies(formData.get("currencyCodes")),
    enabled: bool(formData.get("enabled")),
    reason: String(formData.get("reason") ?? "").trim(),
  });
  redirect("/admin/catalogos?guardado=1");
}

export async function saveCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  saveCategory(getDb(), {
    adminId: admin.account_id,
    code: String(formData.get("code") ?? ""),
    labelEs: String(formData.get("labelEs") ?? ""),
    labelPt: (formData.get("labelPt") as string) || null,
    enabled: bool(formData.get("enabled")),
    reason: String(formData.get("reason") ?? "").trim(),
  });
  redirect("/admin/catalogos?guardado=1");
}
