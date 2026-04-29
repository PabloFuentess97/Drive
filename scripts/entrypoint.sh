#!/bin/sh
# Entry point used by the production Docker image.
#
#  1. Waits for Postgres to be reachable (compose healthcheck normally handles
#     this, but the wait is cheap and removes a class of race conditions).
#  2. Runs Prisma migrations (or `db push` if no migrations folder exists).
#  3. Hands over to the actual server command (CMD).

set -e

if [ -n "$DATABASE_URL" ]; then
  echo "→ Esperando a que la base de datos esté disponible..."
  i=0
  until node -e "
    const url = new URL(process.env.DATABASE_URL);
    require('net').createConnection({ host: url.hostname, port: url.port || 5432 })
      .on('connect', () => process.exit(0))
      .on('error',   () => process.exit(1));
  " >/dev/null 2>&1; do
    i=$((i+1))
    if [ "$i" -ge 60 ]; then
      echo "✗ La base de datos no respondió tras 60 intentos. Abortando."
      exit 1
    fi
    sleep 1
  done
  echo "✓ Base de datos disponible"
fi

echo "→ Aplicando migraciones de Prisma..."
# Llamamos al CLI por su path real porque la salida `standalone` de Next
# no copia los enlaces de `node_modules/.bin/`.
PRISMA="node /app/node_modules/prisma/build/index.js"
if ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  $PRISMA migrate deploy
else
  # Sin migraciones versionadas: sincroniza el esquema directamente.
  $PRISMA db push --skip-generate --accept-data-loss
fi

echo "→ Iniciando aplicación..."
exec "$@"
