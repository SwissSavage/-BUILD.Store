# Multi-stage Dockerfile for the $BUILD.Store Next.js app.
#
# Built by GitHub Actions on every push to main (see
# .github/workflows/build-and-push.yml) and pushed to ghcr.io. Dokploy
# on the Hetzner box pulls the tagged image and runs it — no on-server
# build, no nixpacks download, no disk-fill crashes.
#
# Stages:
#   deps    — install production dependencies (cached across builds)
#   builder — install everything + run `next build`; emits
#             .next/standalone via next.config.mjs `output: "standalone"`
#   runner  — minimal runtime: only the standalone output + static assets
#
# Runtime env vars (AUTH_SECRET, DATABASE_URL, DOCUMENSO_API_KEY, etc.)
# are injected by Dokploy at container start, NOT baked into the image.

# ────────────────────────────────────────────────────────────────
# Stage 1: deps — cache-friendly install of production deps
# ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Only copy manifest files first so this layer stays cached across
# code changes that don't touch dependencies.
COPY package.json package-lock.json ./
RUN npm ci

# ────────────────────────────────────────────────────────────────
# Stage 2: builder — full build
# ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prevent Next.js's telemetry ping during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env vars. Next.js page data collection imports server
# modules that read env at load time (db client, Auth.js config, etc)
# and throws if the values are missing — so we pass dummies at build
# time via docker --build-arg. Real values come in at runtime from
# Dokploy env vars — nothing baked here is a secret or used post-build.
ARG DATABASE_URL
ARG AUTH_SECRET
ARG AUTH_URL
ARG EMAIL_SERVER_HOST
ARG EMAIL_SERVER_PORT
ARG EMAIL_SERVER_USER
ARG EMAIL_SERVER_PASSWORD
ARG EMAIL_FROM
ARG DOCUMENSO_API_KEY
ARG DOCUMENSO_WEBHOOK_SECRET
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ENV DATABASE_URL=$DATABASE_URL \
    AUTH_SECRET=$AUTH_SECRET \
    AUTH_URL=$AUTH_URL \
    EMAIL_SERVER_HOST=$EMAIL_SERVER_HOST \
    EMAIL_SERVER_PORT=$EMAIL_SERVER_PORT \
    EMAIL_SERVER_USER=$EMAIL_SERVER_USER \
    EMAIL_SERVER_PASSWORD=$EMAIL_SERVER_PASSWORD \
    EMAIL_FROM=$EMAIL_FROM \
    DOCUMENSO_API_KEY=$DOCUMENSO_API_KEY \
    DOCUMENSO_WEBHOOK_SECRET=$DOCUMENSO_WEBHOOK_SECRET \
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

RUN npm run build

# ────────────────────────────────────────────────────────────────
# Stage 3: runner — minimal runtime image
# ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build provenance. Passed by CI as --build-arg from the triggering
# commit. Surfaced at /api/debug/session so we can tell, in one page
# load, whether a running container is actually on the code we think
# it is. "Nothing changed after I deployed" has burned multiple
# debugging cycles; this makes stale-container the FIRST thing ruled
# out rather than the last.
#
# Not a secret — it's a public commit SHA on a public repo.
ARG BUILD_SHA=unknown
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME

# Run as non-root for defense in depth.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy the standalone output (server + minimal node_modules) and the
# public + static asset directories. Standalone output already includes
# the server.js entrypoint at the root of the copied tree.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration runner + migration files (task #65). Applied on every
# container start before Next.js takes over. Prevents the class of
# incident from 2026-08-22 where an unrun ALTER TABLE took auth down.
# The runner uses `pg` from the standalone node_modules — already
# included since the app imports it directly.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run migrations, then start Next.js. sh -c so && chaining works.
# Migration failure → non-zero exit → container refuses to start →
# Dokploy healthcheck fails → old container keeps serving. That's
# by design; a bad migration must not reach users.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
