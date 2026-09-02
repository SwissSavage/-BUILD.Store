#!/usr/bin/env node
/**
 * Fixture-usage ratchet.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-09-02)
 *
 * The same bug shipped repeatedly all through beta prep: a surface
 * reads one place and writes another. The write goes to Postgres, the
 * read comes from a fixture array, and the page shows seed data while
 * real work vanishes. Or the reverse, which is worse, because the data
 * lands correctly and is invisible from the moment it arrives.
 *
 * It happened to the walkthrough, to feedback, to inbound submissions,
 * to recognitions, to canonizations, to agreements, and to the profile.
 * I introduced one of them MYSELF on 2026-09-02, moving three inbound
 * writers to Postgres without moving the reader, hours after writing a
 * commit message explaining that writer and reader have to move
 * together.
 *
 * Vigilance demonstrably does not work here. A number that cannot go up
 * does.
 *
 * HOW IT WORKS
 *
 * Counts files outside mock-data and the seeder that import from
 * mock-data. Fails if the count exceeds the recorded baseline. Fixing
 * anything lowers the number and you re-record it; nothing can add a
 * new fixture dependency without deliberately raising the baseline,
 * which is a visible line in a diff rather than an accident.
 *
 * Not a lint rule about style. Every entry in this count is a place
 * where the app can disagree with itself about what is true.
 * ─────────────────────────────────────────────────────────────
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const BASELINE_FILE = "scripts/fixture-usage-baseline.json";
const IMPORT_RE = /from\s+["']@\/lib\/mock-data\//;

function offenders() {
  const files = execSync(
    "git ls-files 'src/**/*.ts' 'src/**/*.tsx'",
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.startsWith("src/lib/mock-data/"))
    .filter((f) => f !== "src/db/seed.ts");

  return files.filter((f) => IMPORT_RE.test(readFileSync(f, "utf8"))).sort();
}

const found = offenders();
const record = process.argv.includes("--record");

if (record) {
  writeFileSync(
    BASELINE_FILE,
    `${JSON.stringify({ count: found.length, files: found }, null, 2)}\n`,
  );
  console.log(`✓ fixture-usage baseline recorded: ${found.length} files`);
  process.exit(0);
}

if (!existsSync(BASELINE_FILE)) {
  console.error(
    `✗ ${BASELINE_FILE} missing. Run: node scripts/check-fixture-usage.mjs --record`,
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));

if (found.length > baseline.count) {
  const added = found.filter((f) => !baseline.files.includes(f));
  console.error(
    `✗ fixture usage went UP: ${baseline.count} → ${found.length}\n`,
  );
  console.error("New files importing @/lib/mock-data:");
  for (const f of added) console.error(`    ${f}`);
  console.error(
    "\nA surface that reads fixtures while its writer uses Postgres (or the\n" +
      "reverse) shows seed data and loses real work. Move the reader and the\n" +
      "writer together, or raise the baseline deliberately with:\n" +
      "    node scripts/check-fixture-usage.mjs --record",
  );
  process.exit(1);
}

if (found.length < baseline.count) {
  console.log(
    `✓ fixture usage DOWN: ${baseline.count} → ${found.length}. ` +
      `Re-record with: node scripts/check-fixture-usage.mjs --record`,
  );
  process.exit(0);
}

console.log(`✓ fixture usage holding at ${found.length} files`);
