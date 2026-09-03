# Yanti demo — imagen Docker para Render (Node 24 por node:sqlite nativo).
# Build y runtime en una sola etapa para mantener paridad con el entorno local
# (vitest resuelve alias @/* al sembrar la demo).

FROM node:24-slim

WORKDIR /app

# Dependencias primero (capa cacheable)
COPY package.json package-lock.json ./
RUN npm ci

# Código fuente
COPY . .

# Build de producción de Next.js
RUN npm run build

# El entrypoint siembra la DEMO (reset + seed con historial) y arranca Next en $PORT.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Disco de la demo (efímero en Render free: se resiembra en cada deploy/boot)
ENV YANTI_DB_PATH=/app/.yanti-local/yanti.db
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
