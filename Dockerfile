# Yanti demo — Dockerfile raíz para Render.
# Construye la app en web/ replicando el flujo local probado.
# Render ejecuta el Dockerfile en la raíz del repo con contexto = raíz.
FROM node:24-slim

WORKDIR /app

# Copiar TODO web/ (package.json, lock, .npmrc, src, tests...)
COPY web/ ./

# Instalar dependencias (incluye devDependencies vía .npmrc) y construir
RUN npm ci && npm run build

# Entrypoint: siembra la demo (vitest) y arranca Next en $PORT.
COPY web/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV YANTI_DB_PATH=/app/.yanti-local/yanti.db
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
