/**
 * Every column in schema.ts must be declared for the SAME table in
 * the migrations, and vice versa.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-24)
 *
 * While adding `axis_reasons` I put it on `customer_feedback_tokens`
 * in schema.ts and on `peer_reviews` in drizzle/0054. tsc passed —
 * an extra column on the wrong table is perfectly valid TypeScript —
 * and nothing else looked. The code would have read a column that did
 * not exist in the database and written to one nothing declared.
 *
 * That is the same failure mode every other guard in here exists for:
 * the compiler checks the shape of the code, not whether the code
 * agrees with the world. A comment saying "keep these in step" is not
 * a constraint.
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT IT DOES NOT DO
 *
 * It compares column NAMES per table, not types, defaults or
 * constraints. Name drift is the failure that actually happens and
 * the one that is silent; a type mismatch surfaces loudly the first
 * time a row is read. Parsing SQL types well enough to compare them
 * would be a parser, and a half-right parser that fails open is worse
 * than no parser — see the note in check-fixture-usage about the guard
 * that reported zero offenders for weeks.
 *
 * So: names only, and it fails CLOSED. If it cannot parse something
 * it says so and exits non-zero rather than reporting clean.
 * ─────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync } from "node:fs";

const SCHEMA_FILE = "src/db/schema.ts";
const MIGRATIONS_DIR = "drizzle";

/** Tables the app declares but deliberately does not own. */
const IGNORED_TABLES = new Set([
  // Auth.js owns these; its adapter creates them.
  "accounts",
  "sessions",
  "verification_tokens",
]);

// ── schema.ts ────────────────────────────────────────────────

function schemaColumns() {
  const src = readFileSync(SCHEMA_FILE, "utf8");
  const tables = new Map();
  // pgTable("name", { ... }) — find each opening and walk braces so a
  // nested object (a $type<...> default, say) cannot end the block
  // early. Walking rather than regexing the close is the whole point:
  // the bug this guard exists for came from a script that matched the
  // first "\n});" and ran into the next table.
  const open = /pgTable\(\s*["']([a-z0-9_]+)["']\s*,\s*\{/g;
  let m;
  while ((m = open.exec(src)) !== null) {
    const table = m[1];
    let depth = 1;
    let i = open.lastIndex;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    if (depth !== 0) {
      console.error(`✗ Unbalanced braces in ${SCHEMA_FILE} for "${table}".`);
      process.exit(1);
    }
    const body = src.slice(open.lastIndex, i - 1);
    const cols = new Set();
    // A column is `propName: builder("sql_name"`, and ONLY that.
    //
    // Matching every `fn("string")` in the body was the first attempt
    // and it reported `.default("pending")` as a column called
    // "pending". A guard that cries wolf gets switched off, so this
    // anchors on the property declaration itself.
    const colRe = /^\s*(?:\/\*\*[\s\S]*?\*\/\s*)?[a-zA-Z_$][\w$]*\s*:\s*[a-zA-Z]+\(\s*["']([a-z0-9_]+)["']/gm;
    let c;
    while ((c = colRe.exec(body)) !== null) cols.add(c[1]);
    tables.set(table, cols);
  }
  return tables;
}

// ── drizzle/*.sql ────────────────────────────────────────────

function migrationColumns() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.error(`✗ No migrations found in ${MIGRATIONS_DIR}/.`);
    process.exit(1);
  }
  const tables = new Map();
  const add = (t, c) => {
    if (!tables.has(t)) tables.set(t, new Set());
    tables.get(t).add(c);
  };

  for (const f of files) {
    const sql = readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf8")
      // Strip line comments so prose about a column is not read as one.
      .replace(/^\s*--.*$/gm, "");

    // CREATE TABLE "t" ( "c" type, "c2" type, ... )
    const create = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([a-z0-9_]+)"?\s*\(/gi;
    let m;
    while ((m = create.exec(sql)) !== null) {
      const table = m[1];
      let depth = 1;
      let i = create.lastIndex;
      while (i < sql.length && depth > 0) {
        const ch = sql[i];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        i++;
      }
      const body = sql.slice(create.lastIndex, i - 1);
      // Identifiers may or may not be quoted — drizzle's generated
      // migrations quote, the hand-written ones mostly do not. A
      // column line is `name type ...`; CONSTRAINT / PRIMARY KEY /
      // FOREIGN KEY / UNIQUE / CHECK lines are not.
      for (const rawLine of body.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE)\b/i.test(line)) {
          continue;
        }
        const c = line.match(/^"?([a-z0-9_]+)"?\s+[a-z]/i);
        if (c) add(table, c[1]);
      }
    }

    // ALTER TABLE "t" ADD COLUMN "c" ... , ADD COLUMN "c2" ...
    const alter = /ALTER TABLE\s+"?([a-z0-9_]+)"?([\s\S]*?);/gi;
    while ((m = alter.exec(sql)) !== null) {
      const table = m[1];
      const colRe = /ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"?([a-z0-9_]+)"?/gi;
      let c;
      while ((c = colRe.exec(m[2])) !== null) add(table, c[1]);
      const dropRe = /DROP COLUMN(?:\s+IF EXISTS)?\s+"?([a-z0-9_]+)"?/gi;
      while ((c = dropRe.exec(m[2])) !== null) {
        tables.get(table)?.delete(c[1]);
      }
    }

    // ALTER TABLE "t" RENAME COLUMN "a" TO "b"
    const rename =
      /ALTER TABLE\s+"?([a-z0-9_]+)"?\s+RENAME COLUMN\s+"?([a-z0-9_]+)"?\s+TO\s+"?([a-z0-9_]+)"?/gi;
    while ((m = rename.exec(sql)) !== null) {
      tables.get(m[1])?.delete(m[2]);
      add(m[1], m[3]);
    }

    // DROP TABLE "t"
    const dropTable = /DROP TABLE(?:\s+IF EXISTS)?\s+"?([a-z0-9_]+)"?/gi;
    while ((m = dropTable.exec(sql)) !== null) tables.delete(m[1]);
  }
  return tables;
}

// ── compare ──────────────────────────────────────────────────

const schema = schemaColumns();
const migrated = migrationColumns();
const problems = [];

for (const [table, cols] of schema) {
  if (IGNORED_TABLES.has(table)) continue;
  const sqlCols = migrated.get(table);
  if (!sqlCols) {
    problems.push(`${table}: declared in schema.ts, no migration creates it`);
    continue;
  }
  const missing = [...cols].filter((c) => !sqlCols.has(c));
  if (missing.length > 0) {
    // The interesting part: say where the column DOES live in SQL, so
    // "I put it on the wrong table" reads as itself rather than as a
    // missing migration.
    for (const c of missing) {
      const elsewhere = [...migrated.entries()]
        .filter(([t, set]) => t !== table && set.has(c))
        .map(([t]) => t);
      problems.push(
        elsewhere.length > 0
          ? `${table}."${c}" is in schema.ts, but the migrations put "${c}" on ${elsewhere.join(", ")}`
          : `${table}."${c}" is in schema.ts and in no migration`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("\n✗ schema.ts and the migrations disagree:\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nA column on the wrong table type-checks fine and fails at runtime.\n" +
      "Fix whichever side is wrong — they describe the same database.\n",
  );
  process.exit(1);
}

console.log(
  `✓ schema matches migrations (${schema.size} tables, ${[...schema.values()].reduce((n, s) => n + s.size, 0)} columns)`,
);
