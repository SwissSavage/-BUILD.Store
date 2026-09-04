#!/usr/bin/env node
/**
 * No client component may reach the database.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * OnChainBadge was changed from reading a fixture to reading Postgres.
 * `tsc` was happy. The production build was not:
 *
 *   Module not found: Can't resolve 'fs'
 *   ./src/db/client.ts
 *   ./src/lib/readers/recognitions.ts
 *   ./src/components/OnChainBadge.tsx
 *   ./src/components/TalentHand.tsx
 *
 * TalentHand is a "use client" component. Importing the badge dragged
 * `pg` into the client bundle, and webpack cannot resolve fs, dns, net
 * or tls in a browser target. Four files deep, and invisible until the
 * Docker build ran in CI.
 *
 * This is the same shape as check-use-server.mjs: a rule TypeScript
 * cannot express, that only `next build` enforces, and `next build`
 * cannot run in the sandbox. So it gets a script.
 *
 * It walks the import graph out of every "use client" file and fails
 * if any path reaches the database client, printing the chain so the
 * fix is obvious rather than a hunt.
 *
 * The fix is nearly always the same: make the leaf component
 * presentational and pass the data in from a server component.
 * ─────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const SRC = "src";
const FORBIDDEN = ["src/db/client.ts"];

/** Every .ts/.tsx under src. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

/** Resolve an import specifier to a file under src, or null. */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules, not ours to police

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return relative(".", c).split("\\").join("/");
  }
  return null;
}

const importsOf = new Map();
const isClient = new Set();
const isServerAction = new Set();

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const key = relative(".", f).split("\\").join("/");

  // A directive is the first STATEMENT, but these files open with
  // long doc comments, so strip comments before looking. An earlier
  // version scanned the first 400 characters and missed "use server"
  // on line 29, which produced three false positives.
  const head = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trimStart();

  if (/^["']use client["']/.test(head)) isClient.add(key);

  // A "use server" module is a boundary, not a dependency. Next
  // replaces the import with a reference stub and the module never
  // enters the client bundle, which is the whole point of server
  // actions. Walking through one would flag every form in the app.
  if (/^["']use server["']/.test(head)) isServerAction.add(key);

  const specs = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  importsOf.set(
    key,
    specs.map((sp) => resolveImport(sp, f)).filter(Boolean),
  );
}

/** Depth-first search for a path from `start` to anything forbidden. */
function findPathToDb(start) {
  const seen = new Set();
  const stack = [[start, [start]]];
  while (stack.length) {
    const [node, path] = stack.pop();
    if (seen.has(node)) continue;
    seen.add(node);
    if (FORBIDDEN.includes(node)) return path;
    // Do not traverse INTO a server action, though a server action is
    // still a valid starting point if it is somehow marked client.
    if (node !== start && isServerAction.has(node)) continue;
    for (const next of importsOf.get(node) ?? []) {
      if (!seen.has(next)) stack.push([next, [...path, next]]);
    }
  }
  return null;
}

const violations = [];
for (const entry of isClient) {
  const path = findPathToDb(entry);
  if (path) violations.push(path);
}

if (violations.length > 0) {
  console.error(
    `\n✗ ${violations.length} client component(s) reach the database.\n`,
  );
  console.error(
    "  A \"use client\" file that transitively imports src/db/client.ts pulls",
  );
  console.error(
    "  `pg` into the browser bundle. The build fails on fs / dns / net / tls.",
  );
  console.error(
    "  Fix: make the leaf presentational and pass the data in from a server",
  );
  console.error("  component.\n");
  for (const path of violations) {
    console.error("  " + path.join("\n    -> "));
    console.error("");
  }
  process.exit(1);
}

console.log(`✓ client components stay off the database (${isClient.size} checked)`);
