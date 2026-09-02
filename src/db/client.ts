/**
 * Postgres client + Drizzle wrapper.
 *
 * Reads DATABASE_URL from process.env — set in Dokploy for production,
 * .env.local or .env for developer machines / CLI scripts. The client
 * uses node-postgres (pg) with a Pool for connection reuse across
 * server actions + request handlers.
 *
 * Consumers import { db } from "@/db/client" and run queries against
 * schema imports from "@/db/schema".
 *
 * IMPORTANT: The env-loader import MUST be first. ES modules hoist
 * imports above statements, and if any other import here happens to
 * read process.env at module-load time, it would fire before dotenv
 * populated the values. env-loader.ts contains the config() calls
 * at its own top level, so its side effects run as part of import
 * resolution rather than after all imports finish.
 */
import "./env-loader";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * DATABASE_URL is required at runtime. Build-time image builds (GitHub
 * Actions → GHCR) pass a dummy value via docker --build-arg so page
 * data collection can import server modules without crashing; runtime
 * uses the real value from Dokploy env vars. Nothing baked at build
 * time is a secret.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. See .env.example. Production reads this from Dokploy env vars; CI builds pass a dummy via the workflow env.",
  );
}

/**
 * Shared Postgres pool.
 *
 * ─────────────────────────────────────────────────────────────
 * SUPABASE (2026-09-01)
 *
 * Production points at Supabase, not the old self-hosted Postgres.
 * The previous sizing note reasoned from "Dokploy Postgres 18 allows
 * 100 connections", which no longer describes anything real.
 *
 * Connection budget is now the binding constraint. `max` is PER
 * PROCESS, and Swarm runs more than one replica, so the real ceiling
 * is max × replicas and it is spent against Supabase's limit rather
 * than a box we own. 20 per replica was already generous against a
 * self-hosted server; against a pooled Supabase instance it is a way
 * to exhaust the pool and start failing sporadically under no
 * particular load.
 *
 * Overridable via DB_POOL_MAX so this can be tuned from Dokploy
 * without a deploy.
 * ─────────────────────────────────────────────────────────────
 */
const POOL_MAX = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10) || 10;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: POOL_MAX,
  idleTimeoutMillis: 30_000,
  // Fail a checkout that cannot be served rather than hanging the
  // request until the platform kills it. A request that cannot get a
  // connection should surface quickly and loudly.
  connectionTimeoutMillis: 10_000,
});

/**
 * Idle-client errors.
 *
 * node-postgres emits 'error' on the pool when an IDLE client drops —
 * a pooler recycling connections, a network blip, a restart on the
 * Supabase side. With no listener attached, Node treats it as an
 * unhandled 'error' event and TAKES DOWN THE PROCESS. That is a whole
 * container dying because one pooled socket closed.
 *
 * The pool discards the bad client on its own. All this has to do is
 * exist, and say so in the log.
 */
pool.on("error", (err) => {
  console.error("[db] idle client error, connection discarded", err);
});

export const db = drizzle(pool, { schema });

export type DbClient = typeof db;