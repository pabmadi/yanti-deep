/**
 * Autenticación local: magic link con hash, single-use, consumo por POST.
 * Sesión en cookie HttpOnly/SameSite=Lax. (RF-AUT-001..006, doc 08 §6.2)
 */
import type { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { id, nowIso, randomToken, sha256 } from "@/data/ids";
import { getAccountByEmail, createAccount, getAccount, type AccountRow } from "@/data/repos/account-repo";
import { sendEmail } from "@/data/infra";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutos
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const MAX_ACTIVE_TOKENS_PER_EMAIL = 3;

export function hashToken(token: string): string {
  return sha256(token);
}

export interface MagicLinkRequest {
  email: string;
  returnPath?: string;
  appBaseUrl: string;
}

/**
 * RF-AUT-004: respuesta neutral (no revela si el correo existe).
 * Crea/usa cuenta según corresponda y encola el email en el buzón fake.
 */
export function requestMagicLink(db: DatabaseSync, req: MagicLinkRequest): { email: string } {
  const email = req.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { email }; // neutral incluso para formato inválido
  }
  // Límite de tokens activos por correo (abuso)
  const active = db
    .prepare("SELECT COUNT(*) AS c FROM magic_link_token WHERE email=? AND consumed_at IS NULL AND expires_at > ?")
    .get(email, nowIso()) as { c: number };
  if (active.c >= MAX_ACTIVE_TOKENS_PER_EMAIL) {
    return { email }; // silencioso anti-abuso
  }
  // Ruta de retorno validada: solo relativa
  const safeReturn = req.returnPath?.startsWith("/") && !req.returnPath.startsWith("//") ? req.returnPath : "/";

  let account = getAccountByEmail(db, email);
  if (!account) {
    account = createAccount(db, {
      accountId: id("acc"),
      displayName: email.split("@")[0],
      email,
    });
  }

  const token = randomToken(32); // 256 bits
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO magic_link_token (token_hash, account_id, email, purpose, return_path, expires_at, created_at)
     VALUES (?, ?, ?, 'login', ?, ?, ?)`,
  ).run(hashToken(token), account.account_id, email, safeReturn, expiresAt, nowIso());

  const magicUrl = `${req.appBaseUrl}/auth/continuar?token=${encodeURIComponent(token)}`;
  sendEmail(db, {
    toEmail: email,
    subject: "Tu enlace para entrar a Yanti",
    bodyText: `Entra a Yanti con este enlace (válido 15 minutos): ${magicUrl}`,
    bodyHtml: `<p>Entra a Yanti con este enlace (válido 15 minutos):</p><p><a href="${magicUrl}">Continuar a Yanti</a></p>`,
    purpose: "magic_link",
  });
  return { email };
}

/**
 * Consume el token (SOLO por POST tras interacción explícita; un GET no debe llamar esto).
 * Atómico: valida + crea sesión + consume token en una transacción.
 */
export function consumeMagicLink(db: DatabaseSync, token: string): { account: AccountRow; sessionToken: string } {
  const hash = hashToken(token);
  const row = db
    .prepare("SELECT * FROM magic_link_token WHERE token_hash=? AND consumed_at IS NULL")
    .get(hash) as
    | { token_hash: string; account_id: string; email: string; purpose: string; return_path: string; expires_at: string }
    | undefined;
  if (!row) {
    throw new Error("ERR_AUTH_TOKEN_INVALIDO");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("ERR_AUTH_TOKEN_VENCIDO");
  }
  const account = getAccount(db, row.account_id);
  if (!account) throw new Error("ERR_AUTH_CUENTA_INEXISTENTE");
  if (account.status !== "ACTIVE") {
    throw new Error("ERR_AUTH_CUENTA_RESTRINGIDA");
  }

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE magic_link_token SET consumed_at=? WHERE token_hash=?").run(nowIso(), row.token_hash);
    const sessionToken = randomToken(32);
    db.prepare(
      `INSERT INTO session (session_id, account_id, token_hash, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id("ses"), account.account_id, hashToken(sessionToken), new Date(Date.now() + SESSION_TTL_MS).toISOString(), nowIso(), nowIso());
    db.exec("COMMIT");
    return { account, sessionToken };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function getSessionAccount(db: DatabaseSync, sessionTokenHash: string): AccountRow | undefined {
  const row = db
    .prepare("SELECT s.account_id, s.expires_at, s.revoked_at, a.* FROM session s JOIN account a ON a.account_id=s.account_id WHERE s.token_hash=?")
    .get(sessionTokenHash) as (AccountRow & { expires_at: string; revoked_at: string | null }) | undefined;
  if (!row) return undefined;
  if (row.revoked_at) return undefined;
  if (new Date(row.expires_at).getTime() < Date.now()) return undefined;
  return row;
}

export function revokeSession(db: DatabaseSync, sessionTokenHash: string): void {
  db.prepare("UPDATE session SET revoked_at=? WHERE token_hash=?").run(nowIso(), sessionTokenHash);
}
