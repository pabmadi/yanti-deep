/**
 * Conexión SQLite vía node:sqlite (Node >= 24). Sin binarios nativos externos.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DB = DatabaseSync;

/** Cast seguro de una fila SQL a un tipo conocido (node:sqlite devuelve Record<string, SQLOutputValue>). */
export function asRow<T>(row: unknown): T {
  return row as T;
}

/** Cast seguro de un array de filas SQL. */
export function asRows<T>(rows: unknown): T[] {
  return rows as T[];
}

let dbInstance: DatabaseSync | null = null;

export function dbPath(): string {
  return process.env.YANTI_DB_PATH ?? join(process.cwd(), ".yanti-local", "yanti.db");
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const path = dbPath();
    mkdirSync(dirname(path), { recursive: true });
    dbInstance = new DatabaseSync(path);
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA busy_timeout = 5000;");
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initSchema(db: DatabaseSync): void {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
}

/** Reinicia el esquema (tests / reseed). Desactiva FKs temporalmente para dropear en cualquier orden. */
export function resetDb(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = OFF;");
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  for (const t of tables) {
    db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  }
  initSchema(db);
  db.exec("PRAGMA foreign_keys = ON;");
}
