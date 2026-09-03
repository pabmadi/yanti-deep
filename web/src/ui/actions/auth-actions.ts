"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getDb } from "@/data/db";
import { requestMagicLink, consumeMagicLink, hashToken } from "@/server/auth";
import { SESSION_COOKIE, logout } from "@/ui/lib/session";
import { DEMO } from "@/data/seed";

/** Deriva la URL base de la request actual para que el magic link apunte al mismo host/puerto. */
async function appBaseUrl(): Promise<string> {
  const envUrl = process.env.YANTI_APP_URL;
  if (envUrl) return envUrl;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() puede lanzar fuera de una request; seguir al default.
  }
  return "http://localhost:3100";
}

/** Solicita un magic link. En la demo, el correo va al buzón local (/dev/buzon). */
export async function requestLoginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const db = getDb();
  const base = await appBaseUrl();
  requestMagicLink(db, { email, returnPath: "/inicio", appBaseUrl: base });
  // Respuesta neutral (RF-AUT-004): no revela si la cuenta existe.
  redirect(`/ingresar?enviado=1&email=${encodeURIComponent(email)}`);
}

/** Consume el token (POST interactivo). Crea la sesión HttpOnly y redirige. */
export async function consumeTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/ingresar?error=1");
  const db = getDb();
  try {
    const { sessionToken } = consumeMagicLink(db, token);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  } catch {
    redirect("/ingresar?error=1");
  }
  redirect("/inicio");
}

export async function logoutAction() {
  await logout();
  redirect("/"); // volver a la landing pública
}

/** Atajo de demo: pide el magic link de una cuenta demo determinada. */
export async function demoLoginAction(formData: FormData) {
  const which = String(formData.get("cuenta") ?? "seller");
  const email = which === "buyer" ? DEMO.BUYER_EMAIL : which === "ops" ? DEMO.ADMIN_EMAIL : DEMO.SELLER_EMAIL;
  const db = getDb();
  const base = await appBaseUrl();
  requestMagicLink(db, { email, appBaseUrl: base });
  redirect(`/dev/buzon?para=${encodeURIComponent(email)}`);
}
