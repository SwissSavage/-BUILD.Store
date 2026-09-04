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
  // No shell globs, no quotes.
  //
  // This used to run `git ls-files 'src/**/*.ts' 'src/**/*.tsx'`. On
  // Windows, execSync runs through cmd.exe, where single quotes are
  // NOT quote characters. git received the literal string including
  // the quotes, matched nothing, and the ratchet reported ZERO
  // offenders. Jamar saw "fixture usage DOWN: 22 -> 0" on a merge that
  // touched fifteen objects.
  //
  // It failed OPEN, which is the worst way for a guard to break: zero
  // offenders always passes, so on Windows this had quietly stopped
  // checking anything. Worse, a `--record` run there would have
  // written a baseline of 0 and made every future run on Linux fail.
  //
  // `git ls-files src` takes no glob, needs no quoting, and behaves
  // identically on both platforms. Filtering happens in JS where the
  // semantics are ours.
  const listed = execSync("git ls-files src", { encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  // An empty list means the command did not do what we think it did.
  // Silence here is exactly the failure mode above.
  if (listed.length === 0) {
    console.error(
      "✗ `git ls-files src` returned nothing. The ratchet cannot check\n" +
        "  anything, so it is failing rather than reporting a clean zero.",
    );
    process.exit(1);
  }

  const files = listed
    .filter((f) => /\.tsx?$/.test(f))
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
