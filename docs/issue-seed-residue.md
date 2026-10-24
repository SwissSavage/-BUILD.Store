# Seed rows from the September production seed are still visible on the live site

## Problem

On 2026-09-22 `npm run db:seed` ran against production. It inserts with
`onConflictDoNothing`, so it added every fixture row that was not already
there. Fixture members, listings, requests and notifications have been on
the live site since.

Jamar has raised this at least five times across a month. As of 2026-10-24
he still sees example profiles. Every attempt so far has failed for a
different reason, and because none of it was tracked here, each attempt
started from scratch.

## What has been ruled out

Written down so the next attempt does not repeat any of it.

1. **The scripts cannot run anywhere.** `scripts/seed-audit.mjs` and
   `scripts/purge-seed.mjs` get `ECONNREFUSED` from a laptop — the
   published Postgres port is gone, which closed a real security hole and
   is the right outcome. On the server, the runner image copies `public`,
   `.next/standalone`, `.next/static`, `drizzle` and
   `scripts/migrate.mjs`; `scripts/` is not in the image. Fixed by moving
   the capability into the app as `/admin/seed-residue`.
2. **A page that reports but cannot delete.** Shipped first as read-only.
   Fixed by adding `purgeUnclaimedSeedUsers()`, which takes no ids and
   recomputes the unclaimed set server-side.
3. **Wrong SQL, four separate times.** `WHERE "userId"` where the column
   is `user_id`; `ANY(${ids})` where Drizzle's `sql` template expands a JS
   array into separate placeholders, so the operator gets no array;
   `quote_sheets.admin_user_ids`, which is on `orders`;
   `cooperative_receipts.recipient_id`, which does not exist. Fixed by
   `verifyColumns()`, which checks every soft-reference column against
   `information_schema` before the transaction opens and fails by name
   rather than rolling back silently.
4. **The purge refused on its own fixture data.** Soft references from
   fixture rows were treated as blockers, so fake data protected fake
   users. Fixed: seed-only quotes are deleted, id arrays trimmed, fixture
   payouts deleted. Only genuinely mixed records refuse.
5. **Deletes took hours.** 59 foreign keys reference `users.id` and 51 of
   the referencing columns had no index, so a single `DELETE FROM users`
   sequentially scanned 51 tables. Fixed by `drizzle/0037_user_fk_indexes.sql`,
   applied in production.

## What is still unknown

The purge has never been observed to succeed, and the last fix has not
been confirmed against production. Two live hypotheses:

- The action still fails, now with a named column in the error.
- **The profiles being seen do not come from `users` at all.** #241 notes
  remaining seed-only tables that have no writer. If a cohort, portfolio,
  listing or notification surface reads one of those, purging `users`
  would never remove what Jamar is looking at. This has not been checked
  and should be checked first.

## Constraints

- Claimed rows are untouchable. A row in `accounts` or `sessions` means
  somebody has signed in as it; that is a person whatever the id looks
  like. `u_jamar`, `u_rob`, `u_sunny`, `u_bayu` and others are real.
- "If there's no record or value that counts it just needs to go." No
  blockers for fixture users specifically.
- The money and peer-review guards stay correct for real members. Most
  members will never be deleted.
- Removal must not be undone by a later deploy, a later seed run, or
  anything short of a reinvite.

## Acceptance criteria

- [ ] The surface Jamar actually sees the example profiles on is
      identified by route, and the table it reads from is named.
- [ ] `npm run db:seed` cannot run against production — guarded by
      environment, not by convention.
- [ ] One admin action removes unclaimed fixture rows and everything
      attached to them, in one transaction, with a confirm step.
- [ ] A failure names the column or table that caused it.
- [ ] Verified by loading the surface afterwards, not by the action
      reporting success.
