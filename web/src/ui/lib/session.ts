/**
 * Sesión de servidor para Next.js: lee la cookie del bearer token y resuelve la cuenta.
 * La cookie es HttpOnly, Secure en prod, SameSite=Lax. Se usa el hash del token.
 */
import { cookies } from "next/headers";
import { getDb } from "@/data/db";
import { getSessionAccount, hashToken, revokeSession } from "@/server/auth";
import type { AccountRow } from "@/data/repos/account-repo";

export const SESSION_COOKIE = "yanti_session";

export async function currentSession(): Promise<{ account: AccountRow } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const account = getSessionAccount(db, hashToken(token));
  return account ? { account } : null;
}

export async function requireAccount(): Promise<AccountRow> {
  const session = await currentSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session.account;
}

/** Para server actions: lanza si no hay sesión o no es admin. */
export async function requireAdmin(): Promise<AccountRow> {
  const account = await requireAccount();
  if (!account.is_admin) {
    throw new Error("FORBIDDEN");
  }
  return account;
}

/** Para páginas: devuelve la cuenta admin o null si no corresponde. */
export async function currentAdmin(): Promise<AccountRow | null> {
  const session = await currentSession();
  if (!session || session.account.is_admin !== 1) return null;
  return session.account;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    revokeSession(getDb(), hashToken(token));
  }
  cookieStore.delete(SESSION_COOKIE);
}
