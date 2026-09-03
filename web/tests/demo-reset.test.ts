/**
 * Resetea y siembra la DB local de la demo en un solo paso.
 * Ejecutar: npx vitest run tests/demo-reset.test.ts
 * (No debe correr junto a flow.test.ts: ambos tocan la DB por defecto.)
 */
import { it } from "vitest";
import { getDb, resetDb } from "@/data/db";
import { ensureSeed } from "@/data/seed";
import { seedDemoData, seedHistory } from "@/data/seed-demo";

it("resetea DB y siembra DEMO-1", () => {
  const db = getDb();
  resetDb(db);
  ensureSeed(db);
  const { completedId, disputeId } = seedDemoData(db);
  const historial = seedHistory(db);
  // Guardar los ids para referencia
  const fs = require("node:fs");
  fs.writeFileSync(".yanti-local/demo-ids.json", JSON.stringify({ completedId, disputeId, historial }, null, 2));
  console.log(`DEMO lista. op_completada=${completedId} dispute=${disputeId} historial=${historial}`);
});
