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

RUN npm run build

# ────────────────────────────────────────────────────────────────
# Stage 3: runner — minimal runtime image
# ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as non-root for defense in depth.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy the standalone output (server + minimal node_modules) and the
# public + static asset directories. Standalone output already includes
# the server.js entrypoint at the root of the copied tree.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
