/**
 * Inicializa la DB local y aplica el seed de la demo.
 * Ejecutar: node --experimental-strip-types --experimental-sqlite src/data/init.mjs
 * (importa módulos TS con extensión explícita .ts)
 */
import { getDb, resetDb, initSchema } from "./db.ts";
import { ensureSeed } from "./seed.ts";

const db = getDb();
resetDb(db);
ensureSeed(db);
console.log("DB lista en", process.env.YANTI_DB_PATH ?? ".yanti-local/yanti.db");
