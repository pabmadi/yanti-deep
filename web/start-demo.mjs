/**
 * Arranque "todo en uno" de la DEMO-1 en Windows.
 * 1) Resetea y siembra la DB con la demo guionizada.
 * 2) Genera magic links para el buzón local.
 * 3) Levanta `next dev` en el puerto indicado (por defecto 3100).
 *
 * Uso: node start-demo.mjs [puerto]
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.argv[2] ?? "3100";

// URL base para los magic links: YANTI_APP_URL si se definió (p.ej. http://192.168.100.34:3100),
// si no, localhost. Se propaga a los procesos hijo.
const appUrl = process.env.YANTI_APP_URL ?? `http://localhost:${port}`;
const childEnv = { ...process.env, NODE_ENV: "development", YANTI_APP_URL: appUrl };

function runVitest(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", file],
      { cwd: __dirname, stdio: "inherit", env: childEnv },
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${file} terminó con código ${code}`))));
  });
}

/**
 * Libera el puerto si está ocupado por un server Next de este proyecto.
 * Si lo ocupa otro programa, aborta con un mensaje claro.
 */
async function ensurePortFree(targetPort) {
  const { execSync } = await import("node:child_process");
  let pids = [];
  try {
    const out = execSync(`netstat -ano | findstr ":${targetPort}" | findstr "LISTENING"`, { encoding: "utf8" });
    pids = [...new Set(out.split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
  } catch {
    return; // sin ocupantes: puerto libre
  }
  if (pids.length === 0) return;
  console.log(`⚠ El puerto ${targetPort} está ocupado por PID(s): ${pids.join(", ")}`);

  const { execFileSync } = await import("node:child_process");
  for (const pid of pids) {
    try {
      const cmd = execFileSync("powershell", ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`], { encoding: "utf8" }).trim();
      const isYantiNext = cmd.includes("Yanti-Deep") && (cmd.includes("next") || cmd.includes("start-server"));
      if (isYantiNext) {
        console.log(`→ Cerrando server anterior de Yanti (PID ${pid})...`);
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } else {
        console.error(`✗ El puerto ${targetPort} lo usa otro proceso (PID ${pid}): ${cmd.slice(0, 100)}`);
        console.error("  Cerrá ese programa o cambiá de puerto: node start-demo.mjs 3101");
        process.exit(1);
      }
    } catch {
      // sin comando legible: asumir que no es de Yanti y avisar
      console.error(`✗ No se pudo identificar el PID ${pid}. Cerrá el proceso que usa el puerto ${targetPort}.`);
      process.exit(1);
    }
  }
  // Pequeña espera para que el puerto se libere
  await new Promise((r) => setTimeout(r, 1500));
}

// Asegurar directorio local
mkdirSync(join(__dirname, ".yanti-local"), { recursive: true });

console.log(`▶ 0/4 Magic links apuntarán a: ${appUrl}`);
console.log(`▶ 1/4 Verificando puerto ${port}...`);
await ensurePortFree(port);

console.log("▶ 2/4 Sembrando la DEMO-1...");
await runVitest("tests/demo-reset.test.ts");

console.log("▶ 3/4 Generando magic links para el buzón...");
await runVitest("tests/gen-links.test.ts");

console.log(`▶ 4/4 Levantando Next dev en http://localhost:${port} ...`);
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-p", port],
  { cwd: __dirname, stdio: "inherit", env: { ...process.env, NODE_ENV: "development" } },
);
server.on("exit", (code) => process.exit(code ?? 0));
