#!/usr/bin/env bash
# Quick start script for a fresh Linux VPS.
# Installs Docker (if missing), sets up the .env file and brings the stack up.

set -euo pipefail

if ! command -v docker >/dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "→ Installing docker compose plugin..."
  apt-get install -y docker-compose-plugin || true
fi

if [ ! -f .env ]; then
  echo "→ Creating .env from .env.example"
  cp .env.example .env
  SECRET=$(openssl rand -base64 64 | tr -d '\n=' | head -c 64)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env
  echo "→ Generated JWT_SECRET. Review .env before continuing."
fi

echo "→ Building and starting containers..."
docker compose up -d --build

echo "✓ App is starting on port ${APP_PORT:-3000}"
echo "  Front a reverse proxy (Caddy/Nginx) with HTTPS in front of it for production."
