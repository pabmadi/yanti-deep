/**
 * Genera la DEMO-1 en la DB local real (sin resetear): siembra operaciones en
 * distintos estados para que la app se vea viva. Ejecutar: npx vitest run tests/demo-data.test.ts
 */
import { it } from "vitest";
import { getDb } from "@/data/db";
import { seedDemoData, seedHistory } from "@/data/seed-demo";

it("siembra datos demo en la DB local", () => {
  const db = getDb();
  const { completedId, disputeId } = seedDemoData(db);
  const historial = seedHistory(db);
  console.log(`Demo sembrada. COMPLETED=${completedId} DISPUTE=${disputeId} historial=${historial}`);
});
