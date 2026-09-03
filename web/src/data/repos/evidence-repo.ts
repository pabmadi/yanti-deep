import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { nowIso, id, sha256 } from "../ids";
import { asRows, asRow } from "../db";

export interface EvidenceRow {
  evidence_id: string;
  operation_id: string;
  purpose: string;
  author_id: string;
  visibility: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sha256: string | null;
  storage_key: string | null;
  status: string;
  created_at: string;
}

export interface StoredFile {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}

/** Almacén local de archivos (evidencia simulada): directorio bajo .yanti-local/uploads. */
const uploadsDir = () => process.env.YANTI_UPLOAD_DIR ?? ".yanti-local/uploads";

/** Guarda bytes y registra metadatos inmutables (hash). El binario nunca va a la DB. */
export function storeEvidence(
  db: DatabaseSync,
  e: { operationId: string; purpose: string; authorId: string; file: StoredFile; visibility?: string },
): EvidenceRow {
  const dir = uploadsDir();
  mkdirSync(dir, { recursive: true });
  const key = id("obj");
  writeFileSync(join(dir, key), e.file.buffer);
  const hash = sha256(e.file.buffer.toString("hex"));
  const evidenceId = id("evi");
  db.prepare(
    `INSERT INTO evidence_item (evidence_id, operation_id, purpose, author_id, visibility, original_name, mime_type, size_bytes, sha256, storage_key, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', ?)`,
  ).run(
    evidenceId,
    e.operationId,
    e.purpose,
    e.authorId,
    e.visibility ?? "PARTIES",
    e.file.originalName,
    e.file.mimeType,
    e.file.sizeBytes,
    hash,
    key,
    nowIso(),
  );
  return getEvidence(db, evidenceId)!;
}

export function getEvidence(db: DatabaseSync, evidenceId: string): EvidenceRow | undefined {
  return db.prepare("SELECT * FROM evidence_item WHERE evidence_id=?").get(evidenceId) as EvidenceRow | undefined;
}

export function listEvidenceForOperation(db: DatabaseSync, operationId: string): EvidenceRow[] {
  return asRows<EvidenceRow>(db.prepare("SELECT * FROM evidence_item WHERE operation_id=? ORDER BY created_at ASC").all(operationId));
}

/** Lectura del binario por clave de almacenamiento (solo servidor autorizado). */
export function readEvidenceContent(storageKey: string): Buffer {
  return readFileSync(join(uploadsDir(), storageKey));
}
