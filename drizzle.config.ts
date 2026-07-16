/**
 * Drizzle Kit configuration.
 *
 * Reads DATABASE_URL from the environment (Dokploy env vars in
 * production; local `.env.local` for developer machines).
 *
 * Migrations land in `drizzle/` at repo root. Schema entry point is
 * `src/db/schema.ts` which re-exports everything.
 */
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and populate before running drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
