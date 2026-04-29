#!/usr/bin/env bash
# Restaura un backup creado con scripts/backup.sh
# Uso:   bash scripts/restore.sh <directorio-del-backup>
#
# CUIDADO: sobrescribe la BBDD y los archivos actuales.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${1:-}"
[ -d "$SRC" ] || { echo "Uso: bash scripts/restore.sh <directorio-del-backup>"; exit 1; }
[ -f "$SRC/db.sql.gz" ]      || { echo "✗ No encuentro $SRC/db.sql.gz"; exit 1; }
[ -f "$SRC/storage.tar.gz" ] || { echo "✗ No encuentro $SRC/storage.tar.gz"; exit 1; }

. ./.env

read -rp "¿Restaurar BBDD y archivos desde '$SRC'? Esto BORRARÁ los actuales (sí/no): " ans
[ "$ans" = "sí" ] || [ "$ans" = "si" ] || { echo "Cancelado."; exit 1; }

echo "→ Parando app para evitar escrituras…"
docker compose stop app

echo "→ Restaurando base de datos…"
gunzip -c "$SRC/db.sql.gz" | \
  docker compose exec -T db \
  psql -U "${POSTGRES_USER:-drive}" -d "${POSTGRES_DB:-drive}"

echo "→ Restaurando archivos…"
docker run --rm \
  -v personaldrive_storage:/dst \
  -v "$(pwd)/$SRC":/src:ro \
  alpine:3 \
  sh -c "rm -rf /dst/* && tar xzf /src/storage.tar.gz -C /dst"

echo "→ Reiniciando app…"
docker compose up -d app

echo "✓ Restauración completada."
