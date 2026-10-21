#!/usr/bin/env node
/**
 * Remove the seed rows nobody ever claimed.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-20)
 *
 * On 2026-09-22 someone ran `npm run db:seed` against production. It
 * inserts with onConflictDoNothing, so it added every fixture row that
 * was not already there and left real data alone. Thirteen fixture
 * members have been sitting on the live site since, and Jamar keeps
 * finding them: "example accounts are still showing up in app as well."
 *
 * Nothing is re-adding them. refuseIfPopulated was written in response
 * to that incident and holds. This is the cleanup that never happened.
 *
 * WHY NOT DELETE BY FIXTURE ID
 *
 * Because some of those ids are real people. u_jamar, u_rob, u_sunny
 * and u_bayu were flagged in September, and the overlap has grown since
 * — Sahtyre, Jrusalam and Abbas Tolgay are all on the live member list
 * now. u_jamar may be the row Jamar himself signs in as. A delete by
 * id takes out live accounts and everything hanging off them.
 *
 * THE LINE THIS SCRIPT DRAWS
 *
 * Claimed means a row in `accounts` or `sessions`. Somebody has signed
 * in as it, so it is a person, whatever its id looks like. Those are
 * never touched — not reported as a decision to make, not offered
 * behind a flag. Untouchable.
 *
 * Unclaimed means no linked account and no session, ever. That is a
 * fixture nobody has been, and deleting it loses nothing.
 *
 * Jamar: "merged... or deleted if they haven't been claimed. If the
 * delete is easiest then just that." This is the delete. Merging a
 * claimed fixture row with a separate real account is a different job
 * and needs a human to say which row wins.
 *
 * DRY RUN BY DEFAULT
 *
 * This deletes from production. It prints the plan and changes nothing
 * unless --apply is passed, because the cost of being wrong here is
 * somebody's account and the cost of looking first is ten seconds.
 *
 *   node scripts/purge-seed.mjs            # plan only
 *   node scripts/purge-seed.mjs --apply    # do it
 * ─────────────────────────────────────────────────────────────
 */
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const APPLY = process.argv.includes("--apply");

/**
 * Fixture ids come from the fixture file, not a list typed in here, so
 * this cannot drift when the fixtures change.
 */
async function seedUserIds() {
  const src = await readFile(join(repo, "src/lib/mock-data/users.ts"), "utf8");
  return [...src.matchAll(/^\s{4}id:\s*"([^"]+)"/gm)].map((m) => m[1]);
}

/**
 * Every column pointing at users.id, read from the live database
 * rather than assumed from schema.ts. What matters is what this
 * database actually has — a column added by hand still has to be
 * cleared before the user row will go.
 */
const DEPENDENTS_SQL = `
  SELECT tc.table_name, kcu.column_name
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
    console.error("DATABASE_URL is not set. Nothing to purge.");
    process.exit(1);
  }

  console.log("=== seed purge ===");
  console.log("Target:", url.replace(/:[^:@]*@/, ":****@"));
  console.log(APPLY ? "Mode:   APPLY — rows will be deleted" : "Mode:   dry run — nothing will change");

  const pool = new Pool({ connectionString: url });
  const ids = await seedUserIds();
  const { rows: deps } = await pool.query(DEPENDENTS_SQL);

  const { rows: present } = await pool.query(
    `SELECT id, handle, first_name, last_name, is_admin
       FROM users WHERE id = ANY($1::text[]) ORDER BY id`,
    [ids],
  );

  console.log(`\nFixtures declare ${ids.length} users; ${present.length} are in this database.\n`);

  const claimed = [];
  const unclaimed = [];

  for (const u of present) {
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM accounts WHERE "userId" = $1) AS accounts,
         (SELECT count(*)::int FROM sessions WHERE "userId" = $1) AS sessions`,
      [u.id],
    );
    const { accounts, sessions } = rows[0];
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "(no name)";

    // What is hanging off the row, so the plan says what goes with it.
    const attached = [];
    for (const d of deps) {
      if (d.table_name === "accounts" || d.table_name === "sessions") continue;
      const q = await pool.query(
        `SELECT count(*)::int AS n FROM "${d.table_name}" WHERE "${d.column_name}" = $1`,
        [u.id],
      );
      if (q.rows[0].n > 0) {
        attached.push({ table: d.table_name, column: d.column_name, n: q.rows[0].n });
      }
    }

    const entry = { ...u, name, accounts, sessions, attached };
    if (accounts > 0 || sessions > 0) claimed.push(entry);
    else unclaimed.push(entry);
  }

  console.log("KEEPING — somebody signs in as these\n");
  if (claimed.length === 0) console.log("  (none)\n");
  for (const u of claimed) {
    console.log(`  ${u.id}  @${u.handle}  ${u.name}${u.is_admin ? "  [admin]" : ""}`);
    console.log(`    ${u.accounts} account(s), ${u.sessions} session(s) — real person, untouched`);
  }

  console.log("\nDELETING — never claimed, no account, no session\n");
  if (unclaimed.length === 0) console.log("  (none)\n");
  for (const u of unclaimed) {
    console.log(`  ${u.id}  @${u.handle}  ${u.name}${u.is_admin ? "  [admin]" : ""}`);
    console.log(
      u.attached.length
        ? `    takes with it: ${u.attached.map((a) => `${a.table}.${a.column}=${a.n}`).join(", ")}`
        : `    nothing attached`,
    );
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to delete the rows above.");
    await pool.end();
    return;
  }
  if (unclaimed.length === 0) {
    console.log("\nNothing to delete.");
    await pool.end();
    return;
  }

  // One transaction. A half-purged user — dependents gone, row still
  // there, or the reverse — is worse than either outcome.
  const client = await pool.connect();
  let deleted = 0;
  try {
    await client.query("BEGIN");
    for (const u of unclaimed) {
      for (const a of u.attached) {
        const r = await client.query(
          `DELETE FROM "${a.table}" WHERE "${a.column}" = $1`,
          [u.id],
        );
        console.log(`  - ${a.table}.${a.column} ${u.id}: ${r.rowCount} row(s)`);
      }
      const r = await client.query("DELETE FROM users WHERE id = $1", [u.id]);
      console.log(`  - users ${u.id}: ${r.rowCount} row(s)`);
      deleted += r.rowCount;
    }
    await client.query("COMMIT");
    console.log(`\nDone. ${deleted} user row(s) removed, ${claimed.length} left alone.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nRolled back, nothing changed:", err.message);
    console.error(
      "A foreign key refused the delete. That means something real references a\n" +
        "fixture row — worth knowing rather than forcing. Run the audit and look\n" +
        "at what points at it.",
    );
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("purge failed:", err.message || err);
  process.exit(1);
});
