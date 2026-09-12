#!/bin/sh
# Yanti demo — arranque en Render/Docker.
# 1) Define la URL pública (Render expone RENDER_EXTERNAL_URL) para los magic links.
# 2) Siembra la DEMO (reset + seed + historial + magic links al buzón local).
# 3) Levanta el server Next.js de producción en el puerto de la plataforma.
set -e

# En Render, RENDER_EXTERNAL_URL trae la URL pública (p.ej. https://yanti-demo.onrender.com).
if [ -z "${YANTI_APP_URL:-}" ] && [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  export YANTI_APP_URL="$RENDER_EXTERNAL_URL"
  echo "[yanti] YANTI_APP_URL detectado de Render: $YANTI_APP_URL"
fi
# Railway expone el dominio público en RAILWAY_PUBLIC_DOMAIN (sin esquema).
if [ -z "${YANTI_APP_URL:-}" ] && [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  export YANTI_APP_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
  echo "[yanti] YANTI_APP_URL detectado de Railway: $YANTI_APP_URL"
fi
if [ -z "${YANTI_APP_URL:-}" ] && [ -n "${RAILWAY_STATIC_URL:-}" ]; then
  case "$RAILWAY_STATIC_URL" in
    http://*|https://*) export YANTI_APP_URL="$RAILWAY_STATIC_URL" ;;
    *) export YANTI_APP_URL="https://${RAILWAY_STATIC_URL}" ;;
  esac
  echo "[yanti] YANTI_APP_URL detectado de Railway: $YANTI_APP_URL"
fi
# Fuera de Render (Docker local), default razonable.
if [ -z "${YANTI_APP_URL:-}" ]; then
  export YANTI_APP_URL="http://localhost:${PORT:-3000}"
fi

echo "[yanti] Sembrando DEMO-1 (base magic links: $YANTI_APP_URL)..."
node --experimental-strip-types node_modules/vitest/vitest.mjs run tests/demo-reset.test.ts
node --experimental-strip-types node_modules/vitest/vitest.mjs run tests/gen-links.test.ts

PORT="${PORT:-3000}"
echo "[yanti] Levantando Next en 0.0.0.0:${PORT} ..."
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PORT"
