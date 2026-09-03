import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/data/db";
import { revokeSession, hashToken } from "@/server/auth";
import { SESSION_COOKIE } from "@/ui/lib/session";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    revokeSession(getDb(), hashToken(token));
  }
  // El header Host trae la dirección real con la que el usuario entró
  // (localhost en la PC, la IP en el celular). request.url puede quedar fijo
  // en localhost aunque se acceda por IP, así que preferimos el Host.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : process.env.YANTI_APP_URL ?? "http://localhost:3100";
  // Tras salir, se vuelve a la landing pública (raíz), no al login.
  const res = NextResponse.redirect(new URL("/", origin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
