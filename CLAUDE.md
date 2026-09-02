# $BUILD.Store — working agreement

Read this before doing anything in this repo. These are not suggestions.
They exist because each one was learned by breaking something.

---

## 1. PR delivery format (locked 2026-08-25)

**Every commit ends with the PR block. No prose between the blocks.**

Four blocks, stacked, in this order, every time:

1. `git push origin <branch>` in a code block
2. GitHub compare URL in a code block
3. PR title in a code block
4. PR body in a fenced markdown block

Base is `main`. Compare URL shape:

```
https://github.com/SwissSavage/-BUILD.Store/compare/main...<branch>
```

No preamble, no post-amble, nothing explanatory between the four blocks.
Anything Jamar needs to hear about the commit goes **above** the push
line, or nowhere at all.

This applies to every commit-and-push cycle. Do not wait to be asked.
Skipping it is friction.

---

## 2. Verify before confirming

**"Verify against what's functional in the repo before confirming."**

Do not report a number, a status, a root cause, or a "that's all that's
left" until it has been checked against the actual code or the actual
data.

- **Never state a guess as a finding.** If the cause has not been
  confirmed, say what was checked, what it showed, and what remains
  unknown. A confident wrong diagnosis costs more than saying "I don't
  know yet."
- **Do not raise a risk without checking whether it is real.** Checking
  usually takes one grep.
- **A task marked "done" can be lying.** Features got marked complete
  because they worked against mock data. When a queue looks
  suspiciously short, measure the gap.
- **The sandbox cannot reach the production database.** Any claim about
  live rows is unverified by definition. Say so, or build the
  diagnostic into the page so it reports itself.
- **Production runs on Supabase.** The local `.env` in this repo is a
  developer file and has been stale before; the source of truth is the
  Dokploy env. NEVER report which database production uses by reading
  the local `.env` — that has already produced one confidently wrong
  answer. Ask, or read it from Dokploy.
- **Supabase is SELF-HOSTED.** Confirmed 2026-09-02 by Kong gateway
  logs (`/usr/local/kong/kong.yml`, openresty); a supabase.com project
  never surfaces gateway container logs. So the data sits on our own
  disk, no third party holds a copy, and backups are entirely our
  responsibility. A backup that has never been restored is not a
  backup, and there is no vendor underneath us.
- **Still unconfirmed: which Postgres the brute-force logs belong to.**
  Self-hosted Supabase does not establish whether those auth failures
  hit Supabase's own Postgres or a separate database service on the
  same host. The port scanning predates the 08-29 cutover by a day,
  which points at a pre-existing service, but that is inference.
- **Do not assume any Postgres host is decommissioned.** A host without
  "supabase" in its name can still be the live Supabase Postgres, since
  a self-hosted install runs on your own domain. Checking the hostname
  for the word "supabase" is not a test, and treating it as one already
  produced advice to snapshot and destroy what may be the production
  database.

## 3. Stop guessing after two failed iterations

If a fix ships and does not work, the **third attempt must be a
diagnostic step, not another code change.** Get the evidence first:
response headers, DevTools cookies, deployed image SHA, actual row
inspection. Then reason from it.

When a container-deployed system misbehaves, verify the running image
matches the latest commit before assuming the code is wrong.

---

## 4. Build constraints that bite silently

- **`export const dynamic = "force-dynamic"` is mandatory** on any page
  that reads the database. CI builds with a **dummy `DATABASE_URL`**, so
  a statically rendered page bakes in an empty result and ships it. This
  has shipped an empty homepage before.
- **A `"use server"` file may only export async functions.** `tsc` does
  not catch violations; `next build` does. `npm run typecheck` runs
  `scripts/check-use-server.mjs` first to catch it locally.
- **`next build` cannot run in the sandbox.** `node_modules` carries
  Windows SWC and esbuild binaries. Typecheck locally, prove the build
  in CI.
- **To unit-test a module, transpile the real file** (`npx tsc <file>
  --outDir ... --jsx react --jsxFactory h`) and import it. Do not
  reimplement its logic in a test script. A reimplementation tests the
  reimplementation, and has already hidden a real bug.

---

## 5. Data and readers

- **No mock fallback, ever.** Readers use `makeReader` + `safely`. A
  reachable-but-empty table is a legitimate answer. Substituting
  fixtures for real data hides a misconfiguration behind fake members,
  which is the exact failure the Postgres cutover exists to kill.
- **MOVE THE READER AND THE WRITER TOGETHER.** The single most
  repeated bug in this codebase: a surface writes to Postgres and reads
  from a fixture, or the reverse. Either way the page shows seed data
  and real work vanishes, and the reverse is worse because the data
  lands correctly and is invisible from the moment it arrives. It hit
  the walkthrough, feedback, inbound submissions, recognitions,
  canonizations, agreements and the profile. On 2026-09-02 I caused one
  myself, moving three inbound writers without the reader, hours after
  writing a commit explaining this exact rule.
  `npm run typecheck` now runs `scripts/check-fixture-usage.mjs`, a
  ratchet on the number of files importing `@/lib/mock-data`. It can go
  down, never up. Vigilance did not work; a number that cannot rise
  does.
- **An empty state must be distinguishable from a broken one.** If a
  surface can render nothing, it needs an admin-visible reason counted
  from the data, not inferred. A section that silently returns `null`
  looks identical to "nothing has happened yet."
- **Money paths:** advisory locks for the $BUILD supply cap, guarded
  updates (`WHERE ... IS NULL` + `.returning()`) for idempotency.
- **Migrations are fail-closed.** A bad one means the container will not
  start and the old one keeps serving.

---

## 6. Product rules that are not negotiable

- **No circumvention.** Talent must not be reachable around the
  cooperative. Public surfaces are governed by the matrix in
  `src/lib/profile-visibility.ts` and `future-modern.md`. A privacy
  control must read live data, never a fixture. When in doubt,
  under-expose.
- **Curation adds, it never subtracts.** Highlighting someone must not
  delete everyone else from a feed.
- **Contractors propose; the client builds a team from who is
  available.** Never frame it as a contractor petitioning and FM
  granting. "Select for the team" / "Not this round", not "Approve" /
  "Decline".
- **Members keep their tier until the community removes them.** A
  rating change does not cost someone membership.
- **First name, last initial** on profiles.
- **No em-dashes in any copy that ships.** It is the primary
  AI-generated tell. Use `**bold**` or `<strong>` when the dash was
  doing emphasis; use a period, comma, or semicolon when it was doing a
  pause. Applies to UI strings, docs, and anything outbound.

---

## 7. Scope discipline

- Jamar's corrections are literal. "That works, stop investigating"
  means stop.
- When told to audit, **audit everything named**, not the first
  plausible cause. Piecemeal fixes to a systemic bug were called out
  explicitly: *"Stop picking out solutions piecemeal. Go look at
  everything that's supposed to be on the site and make sure it actually
  works."*
- Secrets live in Dokploy env only. Never ask for them in chat.
