/**
 * Drizzle Kit configuration.
 *
 * Reads DATABASE_URL from the environment. Env source lookup, in
 * order:
 *   1. .env.local (Next.js developer convention, gitignored)
 *   2. .env (fallback, also gitignored)
 *   3. process.env directly (Dokploy env vars in production)
 *
 * Migrations land in `drizzle/` at repo root. Schema entry point is
 * `src/db/schema.ts` which re-exports everything.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env
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
