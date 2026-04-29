# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20-alpine

# ---------- deps ----------
# Installs all dependencies (including dev) so we can build. We use
# `npm install` so the image builds even if package-lock.json is missing.
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# ---------- build ----------
FROM node:${NODE_VERSION} AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma generate before next build so the client is included in the trace.
RUN npx prisma generate
RUN npm run build

# ---------- runtime ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Runtime deps:
#  - openssl: required by Prisma engine
#  - tini: PID 1 / signal forwarding
#  - wget: used by Docker HEALTHCHECK
RUN apk add --no-cache openssl tini wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV STORAGE_DIR=/data/uploads

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

# Standalone Next.js output bundles only the runtime files needed.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Prisma artefacts (schema for `migrate deploy`, generated client and engines).
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

COPY --chown=nextjs:nodejs scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nextjs
EXPOSE 3000
VOLUME ["/data/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["node", "server.js"]
