#!/usr/bin/env bash
# Actualiza la app a la última versión de la rama actual.
# Uso:   bash scripts/update.sh

set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ git pull"
git pull --ff-only

echo "→ docker compose build --pull"
docker compose build --pull

echo "→ docker compose up -d"
docker compose up -d

echo "→ Limpiando imágenes huérfanas…"
docker image prune -f >/dev/null

echo
echo "✓ Actualización completada. Logs:"
echo "    docker compose logs -f app"
