#!/usr/bin/env node
/**
 * Auto-apply pending Drizzle migrations at container start (task #65).
 *
 * Runs as the first step in the runner container's CMD, before
 * `node server.js`. If migrations fail, the process exits non-zero
 * and the container refuses to start — Dokploy's healthcheck fails,
 * the old container keeps serving, and no broken deploy reaches
 * users. That's the design.
 *
 * Why this exists: on 2026-08-22 an unrun 0004_user_tagline.sql
 * migration took auth down because schema.ts declared a column that
 * Postgres didn't have. This script prevents that class of incident
 * by making sure the DB and the code always agree on shape before
 * the app starts serving requests.
 *
 * Tracking table: `_platform_migrations` (deliberately not named
 * `_drizzle_migrations` to avoid collision with drizzle-kit's own
 * tracking if we ever adopt it). One row per applied migration file.
 *
 * First-run seeding: if a migration errors with a "already exists"
 * Postgres code (42P07 duplicate_table, 42710 duplicate_object,
 * 42701 duplicate_column) we treat it as "prior manual apply" and
 * record it as applied without rolling forward. Handles the current
 * prod state where some migrations landed via manual ALTER TABLEs
 * before this runner existed.
 *
 * Fully-idempotent migrations (IF NOT EXISTS everywhere) commit
 * normally. Non-idempotent ones with pre-existing state fall into
 * the "already exists" path. Truly-pending migrations run and
 * commit normally.
 */
import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DUPE_CODES = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object (constraints, etc.)
  "42701", // duplicate_column
  "42P06", // duplicate_schema
  "42723", // duplicate_function
]);

/**
 * Migration files live in the `drizzle/` directory at project root.
 * In the Docker runner image we copy them to /app/drizzle. In dev
 * (running this script by hand) they're at ../drizzle relative to
 * this file. Try /app/drizzle first (production), fall back to
 * repo-relative (dev).
 */
function resolveMigrationsDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    "/app/drizzle",
    join(here, "..", "drizzle"),
    join(process.cwd(), "drizzle"),
  ];
  return candidates[0]; // check happens inside main
}

async function tryPath(candidates) {
  for (const c of candidates) {
    try {
      await readdir(c);
      return c;
    } catch {
      // try next
    }
  }
  throw new Error(
    `No migrations directory found. Tried: ${candidates.join(", ")}`,
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL not set — refusing to start.");
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const dir = await tryPath([
    "/app/drizzle",
    join(here, "..", "drizzle"),
    join(process.cwd(), "drizzle"),
  ]);
  console.log(`[migrate] migrations dir: ${dir}`);

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    // Idempotent tracking table.
    await client.query(`
      CREATE TABLE IF NOT EXISTS _platform_migrations (
        filename    text PRIMARY KEY,
        applied_at  timestamp with time zone NOT NULL DEFAULT now(),
        applied_via text NOT NULL DEFAULT 'runner'
      )
    `);

    // Sorted so ordering matches the numeric prefix (0000, 0001, ...).
    const files = (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows: appliedRows } = await client.query(
      "SELECT filename FROM _platform_migrations",
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    let ran = 0;
    let skipped = 0;
    let recorded = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip    ${file} (already applied)`);
        skipped += 1;
        continue;
      }

      const sql = await readFile(join(dir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO _platform_migrations (filename, applied_via) VALUES ($1, $2)",
          [file, "runner"],
        );
        await client.query("COMMIT");
        console.log(`[migrate] apply   ${file} ok`);
        ran += 1;
      } catch (err) {
        await client.query("ROLLBACK");
        const code = err && err.code;
        const msg = err && err.message ? String(err.message) : String(err);
        if (DUPE_CODES.has(code) || /already exists/i.test(msg)) {
          // Prior manual apply — record without re-running.
          await client.query(
            "INSERT INTO _platform_migrations (filename, applied_via) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [file, "prior-manual"],
          );
          console.log(
            `[migrate] record  ${file} (prior manual apply detected: ${code || "already-exists"})`,
          );
          recorded += 1;
        } else {
          console.error(`[migrate] FAIL    ${file}: ${msg}`);
          throw err;
        }
      }
    }

    console.log(
      `[migrate] done — applied=${ran}, recorded-as-prior=${recorded}, skipped=${skipped}, total=${files.length}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] runner failed:", err.message || err);
  process.exit(1);
});
