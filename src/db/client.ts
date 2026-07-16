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

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. See .env.example. Production reads this from Dokploy env vars.",
  );
}

/**
 * Shared Postgres pool. Reused across the app instance lifetime.
 * Max connection count tuned modestly — Dokploy Postgres 18 default
 * limit is 100 connections; leaving headroom for pgAdmin / psql
 * sessions and other consumers.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export type DbClient = typeof db;
