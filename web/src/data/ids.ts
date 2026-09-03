import { createHash, randomBytes, randomUUID } from "node:crypto";

/** Genera un ID opaco no secuencial con prefijo legible (doc 06: op_xxx, pay_xxx...). */
export const id = (prefix: string): string => `${prefix}_${randomBytes(9).toString("base64url")}`;

export const uuid = () => randomUUID();

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Token aleatorio de alta entropía (>=128 bits) para magic links / sesiones. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

export const nowIso = () => new Date().toISOString();

/** Código legible de soporte, p.ej. YT-4F7K2. */
export const supportCode = (): string => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `YT-${s}`;
};
