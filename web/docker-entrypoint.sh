#!/bin/sh
# Yanti demo — arranque en Render/Docker.
# 1) Siembra la DEMO (reset + seed + historial + magic links al buzón local).
# 2) Levanta el server Next.js de producción en el puerto de la plataforma.
set -e

echo "[yanti] Sembrando DEMO-1..."
node --experimental-strip-types node_modules/vitest/vitest.mjs run tests/demo-reset.test.ts
node --experimental-strip-types node_modules/vitest/vitest.mjs run tests/gen-links.test.ts

PORT="${PORT:-3000}"
echo "[yanti] Levantando Next en 0.0.0.0:${PORT} ..."
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PORT"
