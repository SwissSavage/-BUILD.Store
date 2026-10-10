#!/usr/bin/env node
/**
 * Every admin page is reachable from the navigation.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05)
 *
 * Admin navigation was three hand-maintained lists in three files:
 * a `tiles` array on the admin home page, <AdminLink> JSX in the nav
 * dropdown, and an `adminLinks` array in the mobile menu. Nothing kept
 * them in agreement and nothing noticed when a new page was added to
 * none of them.
 *
 * The result, measured on 2026-10-05: 61 admin pages existed, the home
 * page listed 26, the dropdown listed 24, the mobile menu listed 23,
 * and 35 pages were reachable only by typing the URL. One of the
 * missing ones was /admin/inbound, the queue every signup on the site
 * lands in, so form submissions were arriving somewhere with no link
 * pointing at it.
 *
 * All three surfaces now render from ADMIN_NAV in src/lib/admin-nav.ts.
 * This script fails the build when an admin page exists that is neither
 * in that list nor declared as a detail route, and when the list points
 * at a page that does not exist.
 * ─────────────────────────────────────────────────────────────
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ADMIN_ROOT = "src/app/(app)/admin";
const REGISTRY = "src/lib/admin-nav.ts";

/** Every route under the admin tree that has a page.tsx. */
function findAdminRoutes(dir, prefix = "/admin") {
  const routes = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "page.tsx") {
      routes.push(prefix);
      continue;
    }
    if (statSync(full).isDirectory()) {
      // Route groups "(x)" and private folders "_x" do not add a segment.
      const segment =
        name.startsWith("(") || name.startsWith("_") ? "" : `/${name}`;
      routes.push(...findAdminRoutes(full, prefix + segment));
    }
  }
  return routes;
}

/**
 * Pull the href strings out of each exported array. Reading the source
 * rather than importing it keeps this script free of a TypeScript
 * loader, which is the same tradeoff the other guard scripts make.
 */
function hrefsIn(source, arrayName) {
  const start = source.indexOf(`${arrayName}`);
  if (start === -1) {
    console.error(`\nCould not find ${arrayName} in ${REGISTRY}.\n`);
    process.exit(1);
  }
  // Anchor on "= [" rather than the next "[", because the type
  // annotation (AdminNavEntry[], string[]) carries brackets of its own.
  const open = source.indexOf("= [", start) + 2;
  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]" && --depth === 0) break;
  }
  const body = source.slice(open, i);
  return [...body.matchAll(/"(\/admin[^"]*)"/g)].map((m) => m[1]);
}

const source = readFileSync(REGISTRY, "utf8");
const listed = hrefsIn(source, "ADMIN_NAV");
const details = hrefsIn(source, "ADMIN_DETAIL_ROUTES");

const actual = findAdminRoutes(ADMIN_ROOT).filter((r) => r !== "/admin");
const known = new Set([...listed, ...details]);

const unreachable = actual.filter((r) => !known.has(r)).sort();
const phantom = [...listed, ...details]
  .filter((r) => !actual.includes(r))
  .sort();
const duplicates = listed.filter((r, i) => listed.indexOf(r) !== i).sort();

let failed = false;

if (unreachable.length > 0) {
  failed = true;
  console.error(
    [
      "",
      `${unreachable.length} admin page(s) are in no navigation list:`,
      "",
      ...unreachable.map((r) => `  ${r}`),
      "",
      `Add each one to ADMIN_NAV in ${REGISTRY}, or to`,
      "ADMIN_DETAIL_ROUTES if it is a detail page you reach by clicking",
      "a row rather than by picking it from a menu.",
      "",
    ].join("\n"),
  );
}

if (phantom.length > 0) {
  failed = true;
  console.error(
    [
      "",
      `${phantom.length} navigation entr(ies) point at a page that does not exist:`,
      "",
      ...phantom.map((r) => `  ${r}`),
      "",
      `Remove them from ${REGISTRY}, or create the page.`,
      "",
    ].join("\n"),
  );
}

if (duplicates.length > 0) {
  failed = true;
  console.error(
    [
      "",
      "ADMIN_NAV lists the same route more than once:",
      "",
      ...[...new Set(duplicates)].map((r) => `  ${r}`),
      "",
    ].join("\n"),
  );
}

if (failed) process.exit(1);

console.log(
  `✓ every admin page is reachable from the nav (${listed.length} destinations, ${details.length} detail routes)`,
);
