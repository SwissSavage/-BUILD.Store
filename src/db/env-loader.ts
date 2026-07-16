/**
 * Env-loader side-effect module.
 *
 * Imported at the top of client.ts and seed.ts so DATABASE_URL is
 * populated from .env.local (Next.js convention) or .env (fallback)
 * BEFORE any module reads process.env.
 *
 * In production Next.js on Dokploy, env vars are already set by the
 * platform before the app starts. dotenv.config() is a no-op in that
 * case because it doesn't overwrite existing process.env values.
 *
 * Why a separate module: ES module imports get hoisted above
 * statements. If you write `config({...})` between two `import`
 * lines, both imports resolve BEFORE the config call runs, so any
 * env-reading code in the second import fires before dotenv has
 * populated process.env. Splitting the config calls into their own
 * module and importing THAT first gives them a proper top-level
 * execution slot ahead of subsequent imports.
 */
import { config } from "dotenv";

// Read .env.local first (Next.js developer convention). Then .env
// as fallback. dotenv doesn't overwrite already-set vars, so:
//   - Dokploy runtime: process.env populated → both calls no-op.
//   - Windows Git Bash + .env.local: .env.local wins.
//   - CI + .env only: .env wins.
config({ path: ".env.local" });
config();
