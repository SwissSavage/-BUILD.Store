#!/usr/bin/env node
/**
 * What did the seed put in this database, and is any of it in use?
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-22)
 *
 * Someone ran `npm run db:seed` against production. The seed inserts
 * with onConflictDoNothing, so it added every fixture row that was not
 * already there and left real data alone. Thirteen seed members turned
 * up on the live site next to the real ones.
 *
 * The obvious cleanup, delete the thirteen seed ids, is wrong. Four of
 * them are real people: u_jamar, u_rob, u_sunny, u_bayu. The app has
 * been running since before Auth.js onboarding existed, so one of
 * those rows may be the account someone actually signs in as. Deleting
 * by id would take out a live account and everything hanging off it.
 *
 * So this script decides nothing and deletes nothing. It reports, per
 * seed id: is the row here, does anybody sign in as it, and what is
 * attached. You read it, then you decide.
 * ─────────────────────────────────────────────────────────────
 *
 * Read-only. Safe to run against production.
 *
 *   node scripts/seed-audit.mjs
 */
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");

/**
 * Seed ids come from the fixture file itself rather than a list typed
 * in here, so this cannot drift out of date when the fixtures change.
 */
async function seedUserIds() {
  const src = await readFile(
    join(repo, "src/lib/mock-data/users.ts"),
    "utf8",
  );
  return [...src.matchAll(/^\s{4}id:\s*"([^"]+)"/gm)].map((m) => m[1]);
}

/**
 * Every table with a column pointing at users.id, read out of the
 * live database rather than assumed from schema.ts. What matters is
 * what this database actually has.
 */
const DEPENDENTS_SQL = `
  SELECT
    tc.table_name,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND ccu.column_name = 'id'
  ORDER BY tc.table_name, kcu.column_name
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Nothing to audit.");
    process.exit(1);
  }
  console.log("=== seed audit ===");
  console.log("Target:", url.replace(/:[^:@]*@/, ":****@"));

  const pool = new Pool({ connectionString: url });
  const ids = await seedUserIds();
  console.log(`\nSeed fixture declares ${ids.length} users.\n`);

  const { rows: deps } = await pool.query(DEPENDENTS_SQL);

  const total = await pool.query("SELECT count(*)::int AS n FROM users");
  const present = await pool.query(
    `SELECT id, handle, first_name, last_name, is_admin, membership_tier,
            created_at, suspended_at
       FROM users WHERE id = ANY($1::text[]) ORDER BY id`,
    [ids],
  );

  console.log(`users table holds ${total.rows[0].n} rows.`);
  console.log(
    `${present.rows.length} of the ${ids.length} seed ids are present.\n`,
  );

  const missing = ids.filter((id) => !present.rows.some((r) => r.id === id));
  if (missing.length) {
    console.log(`Not in this database: ${missing.join(", ")}\n`);
  }

  for (const u of present.rows) {
    // Does a human sign in as this row? An accounts or sessions row is
    // the difference between a fixture and somebody's actual login,
    // and it is the one check that must never be skipped before a
    // delete.
    const signin = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM accounts WHERE "userId" = $1) AS accounts,
         (SELECT count(*)::int FROM sessions WHERE "userId" = $1) AS sessions`,
      [u.id],
    );
    const { accounts, sessions } = signin.rows[0];

    const attached = [];
    for (const d of deps) {
      if (d.table_name === "accounts" || d.table_name === "sessions") continue;
      const q = await pool.query(
        `SELECT count(*)::int AS n FROM "${d.table_name}" WHERE "${d.column_name}" = $1`,
        [u.id],
      );
      if (q.rows[0].n > 0) attached.push(`${d.table_name}.${d.column_name}=${q.rows[0].n}`);
    }

    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "(no name)";
    const live = accounts > 0 || sessions > 0;
    console.log(`${u.id}  @${u.handle}  ${name}`);
    console.log(
      `  tier=${u.membership_tier}${u.is_admin ? " admin" : ""}` +
        `${u.suspended_at ? " suspended" : ""}  created=${String(u.created_at).slice(0, 10)}`,
    );
    console.log(
      live
        ? `  IN USE: ${accounts} linked account(s), ${sessions} session(s). Do not delete this row.`
        : `  no linked account, no session`,
    );
    console.log(
      attached.length
        ? `  attached: ${attached.join(", ")}`
        : `  attached: nothing`,
    );
    console.log("");
  }

  console.log(
    "Nothing was changed. A row with no linked account, no session and\n" +
      "nothing attached is safe to remove. Anything else needs a decision\n" +
      "about what happens to what is hanging off it.",
  );

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
