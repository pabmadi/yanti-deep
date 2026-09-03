import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { id, nowIso } from "../ids";
import { asRow } from "../db";

export interface PostingInput {
  logicalAccount: string;
  side: "DEBIT" | "CREDIT";
  amountMinor: number;
  currency: string;
  component?: string;
}

export interface JournalEntryRow {
  entry_id: string;
  operation_id: string;
  entry_type: string;
  currency: string;
  state: string;
  cause: string;
  cause_ref: string | null;
  policy_version: string | null;
  author: string;
  posted_at: string;
  hash_prev: string | null;
  hash_entry: string;
}

/**
 * Registra un asiento de doble entrada (>=2 postings, débitos = créditos).
 * Append-only: una vez POSTED no se edita ni elimina (INV-FIN-007, PF-INV-002).
 * El efecto externo SIEMPRE se registra después del commit del dominio.
 * `opts.at` permite fijar la fecha del asiento (demo/historial); el hash se
 * calcula sobre los valores reales persistidos, por lo que la cadena se mantiene.
 */
export function postJournalEntry(
  db: DatabaseSync,
  e: {
    operationId: string;
    entryType: string;
    currency: string;
    cause: string;
    causeRef?: string;
    policyVersion?: string;
    author: string;
    postings: PostingInput[];
  },
  opts: { at?: string } = {},
): JournalEntryRow {
  const totalDebit = e.postings.filter((p) => p.side === "DEBIT").reduce((s, p) => s + p.amountMinor, 0);
  const totalCredit = e.postings.filter((p) => p.side === "CREDIT").reduce((s, p) => s + p.amountMinor, 0);
  if (e.postings.length < 2) throw new Error("ledger: se requieren >= 2 postings");
  if (totalDebit !== totalCredit) throw new Error(`ledger: débitos (${totalDebit}) != créditos (${totalCredit})`);
  for (const p of e.postings) {
    if (p.amountMinor <= 0) throw new Error("ledger: postings deben ser positivos");
    if (p.currency !== e.currency) throw new Error("ledger: moneda única por asiento");
  }

  const entryId = id("led");
  const postedAt = opts.at ?? nowIso();
  const prev = db
    .prepare("SELECT hash_entry FROM ledger_entry WHERE operation_id=? ORDER BY posted_at DESC LIMIT 1")
    .get(e.operationId) as { hash_entry: string } | undefined;
  const hashPrev = prev?.hash_entry ?? null;

  const canonical = JSON.stringify({
    op: e.operationId,
    type: e.entryType,
    cur: e.currency,
    cause: e.cause,
    at: postedAt,
    postings: e.postings.map((p) => [p.logicalAccount, p.side, p.amountMinor, p.component ?? null]),
  });
  const hashEntry = createHash("sha256").update(canonical).digest("hex");

  db.prepare(
    `INSERT INTO ledger_entry (entry_id, operation_id, entry_type, currency, state, cause, cause_ref, policy_version, author, posted_at, hash_prev, hash_entry)
     VALUES (?, ?, ?, ?, 'POSTED', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entryId,
    e.operationId,
    e.entryType,
    e.currency,
    e.cause,
    e.causeRef ?? null,
    e.policyVersion ?? null,
    e.author,
    postedAt,
    hashPrev,
    hashEntry,
  );

  const insertPosting = db.prepare(
    `INSERT INTO ledger_posting (posting_id, entry_id, logical_account, side, amount_minor, currency, component)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const p of e.postings) {
    insertPosting.run(id("pst"), entryId, p.logicalAccount, p.side, p.amountMinor, p.currency, p.component ?? null);
  }
  return asRow<JournalEntryRow>(db.prepare("SELECT * FROM ledger_entry WHERE entry_id=?").get(entryId));
}

export interface LedgerBalance {
  account: string;
  debitMinor: number;
  creditMinor: number;
  /** balance = debit - credit (para activos/control); interpretación según cuenta */
  netMinor: number;
}

/** Saldo reconstruido por cuenta lógica (nunca persistido como única verdad). */
export function balancesByAccount(db: DatabaseSync, operationId: string): LedgerBalance[] {
  const rows = db
    .prepare(
      `SELECT logical_account AS account, side, SUM(amount_minor) AS total
       FROM ledger_posting lp JOIN ledger_entry le ON le.entry_id = lp.entry_id
       WHERE le.operation_id = ? GROUP BY logical_account, side`,
    )
    .all(operationId) as { account: string; side: "DEBIT" | "CREDIT"; total: number }[];
  const map = new Map<string, LedgerBalance>();
  for (const r of rows) {
    const cur = map.get(r.account) ?? { account: r.account, debitMinor: 0, creditMinor: 0, netMinor: 0 };
    if (r.side === "DEBIT") cur.debitMinor += r.total;
    else cur.creditMinor += r.total;
    cur.netMinor = cur.debitMinor - cur.creditMinor;
    map.set(r.account, cur);
  }
  return [...map.values()];
}

/** Saldo atribuible: total acreditado (cobrado) menos movimientos a favor de vendedor/comprador. */
export function attributableBalance(db: DatabaseSync, operationId: string): { currency: string; availableMinor: number } {
  const rows = db
    .prepare(
      `SELECT logical_account AS account, side, SUM(amount_minor) AS total, MAX(le.currency) AS currency
       FROM ledger_posting lp JOIN ledger_entry le ON le.entry_id = lp.entry_id
       WHERE le.operation_id = ? AND logical_account IN ('PROTECTED_PRINCIPAL','SELLER_PAYABLE','BUYER_REFUND_PAYABLE')
       GROUP BY logical_account, side`,
    )
    .all(operationId) as { account: string; side: string; total: number; currency: string }[];
  const currency = rows[0]?.currency ?? "ARS";
  // PROTECTED_PRINCIPAL es el "activo" retenido: crédito = entrada, débito = salida.
  const principalCredit = rows.find((r) => r.account === "PROTECTED_PRINCIPAL" && r.side === "CREDIT")?.total ?? 0;
  const principalDebit = rows.find((r) => r.account === "PROTECTED_PRINCIPAL" && r.side === "DEBIT")?.total ?? 0;
  const available = principalCredit - principalDebit;
  return { currency, availableMinor: available };
}
