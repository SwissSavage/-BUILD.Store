#!/usr/bin/env node
/**
 * Catch the one build error `tsc --noEmit` cannot see.
 *
 * Next.js allows ONLY async function exports from a file carrying the
 * `"use server"` directive. Exporting a const, a type, an interface or
 * a sync function from one fails `next build` with:
 *
 *   x Only async functions are allowed to be exported in a
 *     "use server" file.
 *
 * TypeScript has no opinion on this, so a clean typecheck can still
 * produce a broken image. That happened on 2026-09-01 —
 * `export const RETENTION_DAYS = 30` in project-trash-actions.ts —
 * and the failure only surfaced in CI after a push.
 *
 * Runs in a second. Wired into `npm run typecheck` so it can't be
 * forgotten.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "src";
const DIRECTIVE = /^\s*["']use server["']\s*;?\s*$/m;

// Runtime values only. `export type` and `export interface` are erased
// before the Next compiler's check runs, so they're legal and several
// action files already rely on that.
const BAD_EXPORT =
  /^export\s+(?!async\s+function\b)(const|let|var|function|class|enum)\b.*$/gm;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = await walk(ROOT);
const failures = [];

for (const file of files) {
  const src = await readFile(file, "utf8");
  // Only the top of the file counts — a "use server" inside a
  // function body marks that function, not the module.
  const head = src.slice(0, 400);
  if (!DIRECTIVE.test(head)) continue;

  for (const match of src.matchAll(BAD_EXPORT)) {
    const line = src.slice(0, match.index).split("\n").length;
    failures.push({ file, line, text: match[0].trim().slice(0, 90) });
  }
}

if (failures.length > 0) {
  console.error(
    `\n✗ ${failures.length} illegal export(s) in "use server" files.\n` +
      `  Only async functions can be exported. Move constants and types\n` +
      `  to a plain module and import them.\n`,
  );
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}\n    ${f.text}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`✓ use-server exports clean (${files.length} files scanned)`);
