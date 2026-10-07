#!/usr/bin/env node
/**
 * Every inline server action must authenticate its own caller.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-02)
 *
 * `decide` in app/(app)/admin/applications/page.tsx approved
 * membership applications and wrote users.membershipTier with no
 * authorisation check inside it. The page called requireAdmin. The
 * action did not.
 *
 * That is not a small distinction. A server action compiles to a
 * public POST endpoint addressed by a content-hashed id. The id is
 * stable for a build and travels in rendered HTML. Nothing about the
 * page that renders the form gates the endpoint behind it, so a page
 * guard protects the page and nothing else.
 *
 * A sweep at the time found 41 inline actions. 36 called requireAdmin
 * or getCurrentUser. Five did not, and only two of those are meant to
 * be public. This script makes that permanent: an inline action with
 * no auth call fails the build unless it is named in PUBLIC below.
 *
 * Scope note. This checks inline `"use server"` functions inside
 * app/. Module-level "use server" files in lib/ are covered by
 * check-use-server.mjs and their actions are conventionally guarded at
 * the top of each export; extending this there is worth doing and is
 * not what broke.
 * ─────────────────────────────────────────────────────────────
 */
import { readdir, readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, "..", "src", "app");

/**
 * Actions that are deliberately reachable by anyone, with the reason.
 * Adding to this list is a decision, not a formality: it says an
 * unauthenticated stranger may invoke this and that is intended.
 */
const PUBLIC = new Map([
  ["sendMagicLink", "sign-in: the caller cannot be authenticated yet"],
  ["signInWithGoogle", "sign-in: the caller cannot be authenticated yet"],
  ["submitConsultation", "public whitelist form: open by design"],
  [
    "proceed",
    "invite signing: the invite code is the credential, and the " +
      "recipient has no account yet. sendInviteLoiForSignature checks " +
      "the code exists, is unrevoked, unconsumed and unexpired.",
  ],
]);

const AUTH_CALLS = ["requireAdmin", "getCurrentUser", "requireUser"];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Body of a function starting at the opening brace, by brace balance. */
function bodyFrom(src, braceIndex) {
  let depth = 0;
  for (let i = braceIndex; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(braceIndex, i + 1);
    }
  }
  return src.slice(braceIndex);
}

const files = await walk(APP);
const findings = [];
let checked = 0;

for (const file of files) {
  const src = await readFile(file, "utf8");
  if (!src.includes('"use server"')) continue;

  const re = /async function (\w+)\s*\([^)]*\)[^{]*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const body = bodyFrom(src, m.index + m[0].length - 1);
    // Only inline actions: the directive is the first statement.
    if (!/^\{\s*\n?\s*"use server";/.test(body)) continue;
    checked++;
    if (PUBLIC.has(name)) continue;
    if (AUTH_CALLS.some((call) => body.includes(call + "("))) continue;
    findings.push({ name, file: relative(join(here, ".."), file) });
  }
}

if (findings.length > 0) {
  console.error(
    `\n✗ ${findings.length} inline server action(s) with no auth check.\n`,
  );
  for (const f of findings) {
    console.error(`    ${f.name}  ${f.file}`);
  }
  console.error(
    [
      "",
      "A server action is a public POST endpoint. The page's requireAdmin",
      "does not protect it. Call requireAdmin() or getCurrentUser() as the",
      "first statement inside the action itself.",
      "",
      "If the action is genuinely meant to be callable by anyone, add it to",
      "PUBLIC in scripts/check-server-action-auth.mjs with the reason.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `✓ every inline server action authenticates (${checked} checked, ${PUBLIC.size} public by design)`,
);

// ──────────────────────────────────────────────────────────────
// PART TWO: module-level "use server" files (2026-10-07)
//
// Everything above walks inline actions under src/app. A file in
// src/lib with a top-level "use server" publishes every exported async
// function as a public POST endpoint too, and nothing was checking
// those. The audit that prompted this found four live holes: three
// cron sweeps and a project purge, all callable by anyone, plus a
// reserve credit that took the actor's identity from its caller.
//
// Same rule, wider net. A gate is any of the recognised helpers, a
// token the caller must already hold, or the cron secret.
// ──────────────────────────────────────────────────────────────
const LIB_GATES =
  /requireAdmin|requireUser|requireSeller|requireMember|getCurrentUser|isAdmin|assertCronCaller|SESSION_COOKIE|VISITOR_COOKIE|formData\.get\("token"\)|clientToken|inviteCode|getVerifiedQuoteClient/;

// Public on purpose, each with the reason it is safe.
const LIB_PUBLIC = new Map([
  ["startVisitorThread", "visitor chat widget; anonymous by design"],
  ["sendVisitorMessage", "visitor chat widget; thread is cookie-scoped"],
  ["createEpkBookingRequest", "public booking form on an artist's EPK"],
  ["submitProspectiveContribution", "public contribution form on a project"],
  ["sendInviteLoiForSignature", "the invite code is the credential; validated unrevoked, unconsumed, unexpired"],
  ["handleSignup", "public signup intake"],
]);

function libFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) libFiles(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const libOffenders = [];
let libChecked = 0;
let libPublic = 0;

for (const file of libFiles("src/lib")) {
  const src = readFileSync(file, "utf8");
  const directive = src.slice(0, 4000).match(/^\s*["']use server["'];?\s*$/m);
  if (!directive) continue;
  // A directive after an import is not a module-level one.
  if (/^\s*(import|export)\s/m.test(src.slice(0, directive.index))) continue;

  for (const m of src.matchAll(/export async function (\w+)\(/g)) {
    const name = m[1];
    const next = src.indexOf("\nexport async function", m.index + 1);
    const body = src.slice(m.index, next === -1 ? src.length : next);
    libChecked += 1;
    if (LIB_PUBLIC.has(name)) {
      libPublic += 1;
      continue;
    }
    if (!LIB_GATES.test(body)) libOffenders.push({ file, name });
  }
}

if (libOffenders.length > 0) {
  console.error(
    [
      "",
      `${libOffenders.length} exported server action(s) in src/lib have no gate:`,
      "",
      ...libOffenders.map((o) => `  ${o.name}  (${o.file})`),
      "",
      "A module-level \"use server\" publishes every exported async function",
      "as a public POST endpoint. Add an auth check, or add the function to",
      "LIB_PUBLIC in this script with the reason it is safe.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `✓ src/lib server actions gated (${libChecked} checked, ${libPublic} public by design)`,
);
