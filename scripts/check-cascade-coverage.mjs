#!/usr/bin/env node
/**
 * Every table that cascades off users.id must be named in the member
 * footprint.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-04)
 *
 * /admin/members/[id] can now permanently delete an account. Fourteen
 * tables cascade off `users.id`, which means Postgres removes their
 * rows along with the parent and reports success. getMemberFootprint
 * sorts those fourteen into two lists: eight that must BLOCK a delete
 * (agreements, payout methods, portfolio, standing, compliance
 * penalties, fraud signals, EPK, community messages) and six that may
 * go with the account (auth links, sessions, notifications, calendar,
 * walkthrough progress).
 *
 * The failure mode this script exists for is quiet and permanent. Add a
 * fifteenth table with `onDelete: "cascade"` on its users.id reference
 * and it belongs to neither list. Nothing errors. Nothing warns. The
 * delete panel still says the account is empty, because as far as the
 * footprint knows it is, and the rows are gone with no record that they
 * existed. Unlike the ~40 non-cascading references, Postgres will not
 * catch this one for us: cascade means the schema has already agreed.
 *
 * This is the same shape as check-fixture-usage and
 * check-client-boundary. A rule TypeScript cannot express, whose
 * violation is invisible until it has already cost something, so it
 * gets a script rather than vigilance.
 *
 * Adding a table? Put it in `blockers` if losing it with the account
 * would destroy work, money, standing or a compliance record. Put it in
 * `clears` only if it is session or personal state that is meaningless
 * without the account. When in doubt it is a blocker: the cost of a
 * false blocker is that Jamar keeps a row suspended, and the cost of a
 * false clear is that evidence disappears.
 * ─────────────────────────────────────────────────────────────
 */
import { readFileSync } from "node:fs";

const SCHEMA = "src/db/schema.ts";
const FOOTPRINT = "src/lib/readers/member-footprint.ts";

const lines = readFileSync(SCHEMA, "utf8").split("\n");

// Walk the schema tracking which pgTable we are inside. Two shapes
// appear in this file: pgTable("name", { ... }) on one line, and
// pgTable(\n  "name", for the tables that take a third config argument.
const cascading = [];
let current = null;
for (let i = 0; i < lines.length; i++) {
  if (/^export const \w+ = pgTable\(/.test(lines[i])) {
    const sameLine = lines[i].match(/pgTable\("([a-z_]+)"/);
    if (sameLine) {
      current = sameLine[1];
    } else {
      const nextLine = (lines[i + 1] ?? "").match(/"([a-z_]+)"/);
      current = nextLine ? nextLine[1] : null;
    }
  }
  if (/users\.id,\s*\{\s*onDelete:\s*"cascade"\s*\}/.test(lines[i])) {
    if (current) cascading.push(current);
  }
}

const tables = [...new Set(cascading)];

if (tables.length === 0) {
  // The regexes stopped matching, most likely because the schema was
  // reformatted. Fail rather than report a clean run, because a guard
  // that has silently stopped checking is worse than no guard.
  console.error(
    "\n✗ Found no cascading references to users.id in " +
      SCHEMA +
      ".\n  There are supposed to be fourteen. The parser has probably\n" +
      "  broken on a reformat. Fix this script rather than deleting it.\n",
  );
  process.exit(1);
}

const footprint = readFileSync(FOOTPRINT, "utf8");
const missing = tables.filter((t) => !footprint.includes(`"${t}"`));

if (missing.length > 0) {
  console.error(
    `\n✗ ${missing.length} table(s) cascade off users.id but are not in the member footprint.\n`,
  );
  console.error(
    "  Deleting a member silently destroys their rows in these tables,",
  );
  console.error(
    "  and the delete panel will still call the account empty:\n",
  );
  for (const t of missing) console.error(`    ${t}`);
  console.error(
    `\n  Add each to blockers or clears in ${FOOTPRINT}. When in doubt,\n` +
      "  blockers. See the header comment in that file.\n",
  );
  process.exit(1);
}

console.log(
  `✓ member footprint covers every cascade off users.id (${tables.length} tables)`,
);
