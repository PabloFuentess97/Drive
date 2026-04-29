#!/bin/sh
set -e

echo "→ Running Prisma migrations..."
npx --no-install prisma migrate deploy || npx --no-install prisma db push

echo "→ Starting application..."
exec "$@"
