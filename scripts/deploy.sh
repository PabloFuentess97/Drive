#!/usr/bin/env bash
# Despliegue inicial de PersonalDrive en un VPS Linux.
# Uso:   sudo bash scripts/deploy.sh
#
# Lo que hace:
#   1. Comprueba dependencias (docker, docker compose, openssl).
#   2. Si no existe `.env`, lo crea a partir de `.env.production.example`
#      y autogenera JWT_SECRET y POSTGRES_PASSWORD.
#   3. Pide DOMAIN y ACME_EMAIL si están en blanco.
#   4. Construye y arranca el stack.

set -euo pipefail

cd "$(dirname "$0")/.."

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "✗ Falta '$1'. Instálalo y vuelve a ejecutar."; exit 1; }
}

require docker
docker compose version >/dev/null 2>&1 || { echo "✗ Falta el plugin 'docker compose'."; exit 1; }
require openssl

if [ ! -f .env ]; then
  echo "→ Creando .env a partir de .env.production.example"
  cp .env.production.example .env

  JWT=$(openssl rand -base64 64 | tr -d '\n=' | head -c 80)
  PG=$(openssl rand -base64 32  | tr -d '\n=' | head -c 32)

  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|"             .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG}|" .env

  echo "✓ .env generado. Edítalo con tu DOMAIN y ACME_EMAIL antes de continuar:"
  echo "   nano .env"
  echo
  read -rp "Pulsa ENTER cuando lo hayas editado para continuar… " _
fi

# Comprobaciones mínimas.
. ./.env
: "${DOMAIN:?DOMAIN no definido en .env}"
: "${ACME_EMAIL:?ACME_EMAIL no definido en .env}"
: "${JWT_SECRET:?JWT_SECRET no definido en .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD no definido en .env}"

echo "→ DOMAIN=$DOMAIN"
echo "→ Construyendo y arrancando contenedores…"
docker compose pull --ignore-pull-failures
docker compose build --pull
docker compose up -d

echo
echo "✓ Stack arrancado. Sigue los logs con:"
echo "    docker compose logs -f"
echo
echo "→ Cuando el DNS de $DOMAIN apunte a este servidor, Caddy emitirá un"
echo "  certificado de Let's Encrypt automáticamente la primera vez que se"
echo "  acceda por HTTPS."
