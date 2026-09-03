"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/data/db";
import { requireAdmin } from "@/ui/lib/session";
import {
  createPolicyDraft,
  publishPolicy,
  retirePolicy,
  type PolicyScope,
} from "@/server/admin-policy";
import { upsertSetting } from "@/data/repos/setting-repo";

function int(formData: FormData, key: string): number | undefined {
  const v = String(formData.get(key) ?? "").trim();
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function createPolicyAction(formData: FormData) {
  const admin = await requireAdmin();
  const scope: PolicyScope = {
    countryCode: String(formData.get("countryCode") ?? "").toUpperCase(),
    currency: String(formData.get("currency") ?? "").toUpperCase(),
    categoryCode: String(formData.get("categoryCode") ?? "").toUpperCase(),
  };
  const policy = createPolicyDraft(getDb(), {
    adminId: admin.account_id,
    scope,
    values: {
      buyerRatePct: Number(formData.get("buyerRatePct") ?? 0),
      sellerRatePct: Number(formData.get("sellerRatePct") ?? 0),
      buyerFixedMinor: int(formData, "buyerFixedMinor"),
      sellerFixedMinor: int(formData, "sellerFixedMinor"),
    },
    reason: String(formData.get("reason") ?? "").trim(),
  });
  redirect(`/admin/configuracion/politicas/${policy.policy_id}?creada=1`);
}

export async function publishPolicyAction(formData: FormData) {
  const admin = await requireAdmin();
  const policyId = String(formData.get("policyId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  publishPolicy(getDb(), { adminId: admin.account_id, policyId, reason });
  redirect(`/admin/configuracion/politicas/${policyId}?publicada=1`);
}

export async function retirePolicyAction(formData: FormData) {
  const admin = await requireAdmin();
  const policyId = String(formData.get("policyId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  retirePolicy(getDb(), { adminId: admin.account_id, policyId, reason });
  redirect(`/admin/configuracion/politicas/${policyId}?retirada=1`);
}

export async function updateSettingAction(formData: FormData) {
  const admin = await requireAdmin();
  const key = String(formData.get("key") ?? "");
  const raw = String(formData.get("value") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const value = Number(raw);
  upsertSetting(getDb(), {
    key,
    value,
    description: String(formData.get("description") ?? "").trim() || undefined,
    updatedBy: admin.account_id,
    reason,
  });
  redirect("/admin/configuracion?guardado=1");
}
