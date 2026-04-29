#!/usr/bin/env bash
# Crea un backup completo: dump SQL + tar de los archivos subidos.
# Uso:   bash scripts/backup.sh [destino]
# Por defecto guarda en ./backups/<fecha>/

set -euo pipefail

cd "$(dirname "$0")/.."

DEST="${1:-./backups/$(date +%Y-%m-%d_%H%M%S)}"
mkdir -p "$DEST"

. ./.env

echo "→ Volcando base de datos…"
docker compose exec -T db \
  pg_dump -U "${POSTGRES_USER:-drive}" -d "${POSTGRES_DB:-drive}" \
  | gzip > "$DEST/db.sql.gz"

echo "→ Empaquetando archivos subidos…"
docker run --rm \
  -v personaldrive_storage:/src:ro \
  -v "$(pwd)/$DEST":/dst \
  alpine:3 \
  sh -c "tar czf /dst/storage.tar.gz -C /src ."

echo "✓ Backup creado en: $DEST"
ls -lh "$DEST"
