#!/usr/bin/env bash
# Build aplikasi tanpa kompilasi Next.js di dalam Docker.
# Berguna untuk VM kecil (RAM 2 GB) yang tersendat saat `docker build` penuh.
#
# Prasyarat di host: Node.js 20 dan dependensi sudah terpasang (npm ci).
# Pemakaian: ./scripts/build-runtime.sh

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> build Next.js di host"
npm run build

echo "==> menyiapkan konteks runtime"
CTX="/tmp/enviro-runtime-ctx"
rm -rf "$CTX"
mkdir -p "$CTX/.next"

cp -a .next/standalone/. "$CTX/"
cp -a .next/static "$CTX/.next/static"
cp -a public "$CTX/public"
cp -a docker-entrypoint.sh "$CTX/docker-entrypoint.sh"

cat > "$CTX/Dockerfile" <<'EOF'
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN mkdir -p /app/data
COPY . .
RUN mv /app/.next /app/.next-dist
EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
EOF

echo "==> build image"
docker build -t sensor-dashboard-app:latest "$CTX"
rm -rf "$CTX"

echo "==> recreate container app"
docker compose up -d --force-recreate app

echo "==> selesai"
curl -s -o /dev/null -w 'health: %{http_code}\n' http://127.0.0.1:3000/enviro/api/health || true
