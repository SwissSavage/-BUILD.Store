"use server";

/**
 * Delete the seed rows nobody ever claimed.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-21)
 *
 * On 2026-09-22 someone ran db:seed against production. It inserts with
 * onConflictDoNothing, so it added every fixture row that was not
 * already there. Thirteen fixture members have been on the live site
 * since. Jamar has now raised it three times — "example accounts are
 * still showing up in app as well" — and the last thing I shipped was
 * a page that reports the problem without fixing it.
 *
 * His instruction, verbatim: "merged... or deleted if they haven't
 * been claimed. If the delete is easiest then just that."
 *
 * WHY THIS ACTION TAKES NO IDS
 *
 * It accepts nothing from the caller. Not a list, not a single id, not
 * a confirmation token. It recomputes the unclaimed set on the server
 * at execution time and deletes exactly that.
 *
 * This module carries "use server", so every export is a public POST
 * endpoint with a content-hashed id — the dominant bug class in this
 * codebase and the one the guard scripts exist for. An action that
 * accepted ids would be a remote row-deleter behind an admin check.
 * An action that accepts nothing can only ever do the one safe thing,
 * whoever calls it and however they got the id.
 *
 * WHAT CLAIMED MEANS
 *
 * A row in `accounts` or `sessions`. Somebody has signed in as it, so
 * it is a person, whatever the id looks like. Four fixture ids were
 * flagged as real people in September — u_jamar, u_rob, u_sunny,
 * u_bayu — and the overlap has grown: Sahtyre, Jrusalam and Abbas
 * Tolgay are all on the member list now. u_jamar may be the row Jamar
 * signs in as, so a delete by fixture id would take out the admin
 * account running the delete.
 *
 * Claimed rows are not skipped with a warning. They are never in the
 * candidate set.
 *
 * WHY DEPENDENTS COME FROM information_schema
 *
 * Rather than a hand-maintained list of tables. What matters is what
 * this database actually has: a column added by hand still has to be
 * cleared before the user row will go, and a list in this file would
 * be one more thing to keep in sync. The live catalogue cannot drift
 * from the live database.
 *
 * ONE TRANSACTION. A half-purged user — dependents gone, row still
 * there, or the reverse — is worse than either outcome. A foreign key
 * that refuses rolls the whole thing back and says which table
 * objected, because something real pointing at a fixture row is worth
 * knowing rather than forcing.
 * ─────────────────────────────────────────────────────────────
 */

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export interface SeedPurgeResult {
  ok: boolean;
  message: string;
  /** Ids actually removed, for the confirmation line. */
  removed?: string[];
}

interface DependentColumn {
  table_name: string;
  column_name: string;
}

/**
 * References to users that Postgres does not know about.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS RESOLVES RATHER THAN REFUSES (2026-10-21)
 *
 * Six columns hold user ids outside the foreign-key graph, so the
 * catalogue-driven sweep below cannot see them:
 *
 *   projects.admin_user_ids               jsonb array
 *   projects.assigned_member_ids          jsonb array
 *   quote_sheets.admin_user_ids           jsonb array
 *   cooperative_quotes.proposed_builders  jsonb, userId per entry
 *   revenue_splits.recipient_id           text, "user id OR sentinel"
 *   cooperative_receipts.recipient_id     text, same
 *
 * The first version refused the whole purge on any hit. Jamar:
 * "There shouldn't be any blockers... you made a bunch of fake users
 * permanent and we don't need to keep them at all."
 *
 * He is right and the refusal was incoherent. A quote whose Builders
 * are all fixtures came out of the same seed run as the fixtures, has
 * never been sent to anybody, and is worth exactly nothing. Refusing
 * to delete a fake user because fake data points at them is how the
 * fakes became permanent.
 *
 * His rule: "If there's no record or value that counts it just needs
 * to go."
 *
 * So each reference is resolved by what it is rather than blocked:
 *
 *   arrays of ids    the id is pulled out of the array. The project
 *                    or quote sheet is real and stays; it just stops
 *                    naming somebody who no longer exists.
 *
 *   seed-only quote  every proposed Builder is a candidate, so the
 *                    whole quote is seed residue and goes with them.
 *
 *   mixed quote      at least one real Builder, so the quote is real
 *                    work. THIS is the only thing that still refuses,
 *                    and it has to: deleting it would destroy a real
 *                    proposal, and editing a fixture out of a quote
 *                    that was sent to a client rewrites what they
 *                    were shown.
 *
 *   fixture payouts  a revenue split or receipt paid to a candidate
 *                    is fictional money. Deleted.
 * ─────────────────────────────────────────────────────────────
 */
/**
 * `ids` as one Postgres text[] rather than a list of placeholders.
 *
 * Drizzle's sql template expands a JS array into $1, $2, $3…, so
 * `= ANY(${idArray(ids)})` compiles to `= ANY($1, $2, $3)` and Postgres answers
 * "op ANY/ALL (array) requires array on right side". It needs a single
 * array-typed parameter. ARRAY[...]::text[] is that, with every element
 * still bound rather than interpolated.
 *
 * Found by clicking the button: the transaction rolled back and
 * reported a foreign key refusal, which was my error message guessing.
 * It was never a foreign key.
 */
function idArray(ids: string[]) {
  return sql`ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::text[]`;
}

interface SoftRefOutcome {
  /** Quotes that mix real and fixture Builders. The only hard stop. */
  mixedQuotes: string[];
  /** What was cleaned up, for the confirmation line. */
  resolved: string[];
}

async function resolveSoftReferences(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ids: string[],
): Promise<SoftRefOutcome> {
  const resolved: string[] = [];

  // Quotes naming only candidates are seed residue; quotes naming a
  // real Builder too are real work.
  const quotes = (await tx.execute(sql`
    SELECT q.id,
           bool_and(b->>'userId' = ANY(${idArray(ids)})) AS all_seed
    FROM cooperative_quotes q,
         jsonb_array_elements(q.proposed_builders) AS b
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(q.proposed_builders) AS c
      WHERE c->>'userId' = ANY(${idArray(ids)})
    )
    GROUP BY q.id
  `)) as unknown as { rows: Array<{ id: string; all_seed: boolean }> };

  const seedOnly = quotes.rows.filter((r) => r.all_seed).map((r) => r.id);
  const mixedQuotes = quotes.rows.filter((r) => !r.all_seed).map((r) => r.id);

  if (mixedQuotes.length > 0) return { mixedQuotes, resolved };

  if (seedOnly.length > 0) {
    await tx.execute(
      sql`DELETE FROM cooperative_quote_versions WHERE quote_id = ANY(${seedOnly})`,
    );
    await tx.execute(sql`DELETE FROM cooperative_quotes WHERE id = ANY(${seedOnly})`);
    resolved.push(
      `${seedOnly.length} seed-only quote${seedOnly.length === 1 ? "" : "s"}`,
    );
  }

  // Pull the ids out of the id arrays. The owning row is real.
  for (const [table, column] of [
    ["projects", "admin_user_ids"],
    ["projects", "assigned_member_ids"],
    ["quote_sheets", "admin_user_ids"],
  ] as Array<[string, string]>) {
    const r = await tx.execute(sql`
      UPDATE ${sql.identifier(table)} t
      SET ${sql.identifier(column)} = COALESCE((
        SELECT jsonb_agg(e.v)
        FROM jsonb_array_elements_text(t.${sql.identifier(column)}) AS e(v)
        WHERE e.v <> ALL(${idArray(ids)})
      ), '[]'::jsonb)
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(t.${sql.identifier(column)}) AS e(v)
        WHERE e.v = ANY(${idArray(ids)})
      )
    `);
    const n = (r as unknown as { rowCount?: number }).rowCount ?? 0;
    if (n > 0) resolved.push(`${table}.${column} cleaned on ${n} row${n === 1 ? "" : "s"}`);
  }

  // Fictional money.
  for (const [table, column] of [
    ["revenue_splits", "recipient_id"],
    ["cooperative_receipts", "recipient_id"],
  ] as Array<[string, string]>) {
    const r = await tx.execute(
      sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ANY(${idArray(ids)})`,
    );
    const n = (r as unknown as { rowCount?: number }).rowCount ?? 0;
    if (n > 0) resolved.push(`${table}=${n}`);
  }

  return { mixedQuotes, resolved };
}

export async function purgeUnclaimedSeedUsers(): Promise<SeedPurgeResult> {
  const admin = await requireAdmin();

  // Candidates: seed-shaped ids with no sign-in of any kind. Computed
  // here, from the database, at execution time. Nothing is accepted
  // from the caller — see the WHY above.
  const candidates = (await db.execute(sql`
    SELECT u.id, u.handle
    FROM users u
    WHERE u.id LIKE 'u\\_%'
      AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id)
    ORDER BY u.id
  `)) as unknown as { rows: Array<{ id: string; handle: string | null }> };

  if (candidates.rows.length === 0) {
    return {
      ok: true,
      message:
        "Nothing to remove. Every seed-shaped id here belongs to somebody who signs in.",
    };
  }
  const ids = candidates.rows.map((r) => r.id);

  // Every column pointing at users.id, read from the live catalogue.
  const deps = (await db.execute(sql`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
    ORDER BY tc.table_name, kcu.column_name
  `)) as unknown as { rows: DependentColumn[] };

  const cleared: string[] = [];
  let blocked: string[] = [];
  try {
    await db.transaction(async (tx) => {
      // Resolve what the catalogue cannot see, inside the same
      // transaction so a refusal leaves nothing half-done.
      const soft = await resolveSoftReferences(tx, ids);
      if (soft.mixedQuotes.length > 0) {
        blocked = soft.mixedQuotes;
        throw new Error("MIXED_QUOTE");
      }
      cleared.push(...soft.resolved);

      for (const d of deps.rows) {
        // accounts and sessions are empty for every candidate by
        // definition — that is what made them candidates.
        if (d.table_name === "accounts" || d.table_name === "sessions") continue;
        // Identifiers come from information_schema, not from input, so
        // there is no user-supplied string in this statement. The ids
        // are still bound rather than interpolated.
        const res = await tx.execute(
          sql`DELETE FROM ${sql.identifier(d.table_name)}
              WHERE ${sql.identifier(d.column_name)} = ANY(${idArray(ids)})`,
        );
        const n = (res as unknown as { rowCount?: number }).rowCount ?? 0;
        if (n > 0) cleared.push(`${d.table_name}.${d.column_name}=${n}`);
      }
      await tx.execute(sql`DELETE FROM users WHERE id = ANY(${idArray(ids)})`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "MIXED_QUOTE") {
      return {
        ok: false,
        message:
          `Refusing. ${blocked.length} quote${blocked.length === 1 ? "" : "s"} ` +
          `propose both a real Builder and one of these rows — ${blocked.join(", ")}. ` +
          `Deleting would destroy a real proposal, and editing the fixture out of a ` +
          `quote a client was shown rewrites the record of what they saw. Replace the ` +
          `Builder on that quote first.`,
      };
    }
    return {
      ok: false,
      message:
        `Rolled back, nothing changed. ${message}` +
        (/violates foreign key/i.test(message)
          ? " — something real references one of these rows. Worth looking at rather than forcing."
          : ""),
    };
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.deleted",
    resourceKind: "user",
    resourceId: ids.join(","),
    before: { seedUsers: ids, dependents: cleared },
    after: null,
    reason:
      "Unclaimed seed rows from the 2026-09-22 production seed run. No linked account or session on any of them.",
  });

  revalidatePath("/admin/seed-residue");
  revalidatePath("/cohort");
  revalidatePath("/community");
  revalidatePath("/portfolio");

  return {
    ok: true,
    message:
      `Removed ${ids.length} unclaimed row${ids.length === 1 ? "" : "s"}` +
      (cleared.length ? `, and ${cleared.join(", ")}.` : "."),
    removed: ids,
  };
}
