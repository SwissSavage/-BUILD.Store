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
 * WHY THIS CHECK EXISTS (2026-10-21)
 *
 * The delete below clears every column information_schema reports as
 * pointing at users.id, which was the whole safety story until Jamar
 * sent a screenshot of /admin/members and I looked at Sunny Su.
 *
 * Sunny is a real designer. She is named in the URL Media quote sheet.
 * Her row here is a fixture with an @example.com address, so she is
 * unclaimed and would have been deleted — and cooperative_quotes
 * stores its Builders in `proposed_builders`, which is JSONB. Not a
 * foreign key. Postgres would not have refused, the catalogue would
 * not have reported it, and the quote would have been left pointing
 * at a user id that resolves to nothing. Silently.
 *
 * That is the failure this whole page was built to avoid, reintroduced
 * one layer down.
 *
 * Six columns hold user ids outside the FK graph:
 *
 *   projects.admin_user_ids           jsonb array
 *   projects.assigned_member_ids      jsonb array
 *   cooperative_quotes.proposed_builders  jsonb, userId per entry
 *   quote_sheets.admin_user_ids       jsonb array
 *   revenue_splits.recipient_id       text — "user id OR sentinel
 *                                     string", per its own comment,
 *                                     which is why it has no FK
 *   cooperative_receipts.recipient_id same
 *
 * Found rather than assumed: a reference here refuses the delete and
 * names what holds it. Refusing is right. A fixture row that real work
 * points at is not a fixture any more, whatever its email says, and
 * the person who needs to know is whoever is about to click the
 * button.
 * ─────────────────────────────────────────────────────────────
 */
async function softReferences(ids: string[]): Promise<string[]> {
  const found: string[] = [];

  const jsonbArray: Array<[string, string]> = [
    ["projects", "admin_user_ids"],
    ["projects", "assigned_member_ids"],
    ["quote_sheets", "admin_user_ids"],
  ];
  for (const [table, column] of jsonbArray) {
    const r = (await db.execute(sql`
      SELECT count(*)::int AS n
      FROM ${sql.identifier(table)} t
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(t.${sql.identifier(column)}) AS e(v)
        WHERE e.v = ANY(${ids})
      )
    `)) as unknown as { rows: Array<{ n: number }> };
    const n = r.rows[0]?.n ?? 0;
    if (n > 0) found.push(`${table}.${column} (${n} row${n === 1 ? "" : "s"})`);
  }

  // proposed_builders is an array of objects carrying userId, not an
  // array of strings, so it needs the object form.
  const quotes = (await db.execute(sql`
    SELECT count(*)::int AS n
    FROM cooperative_quotes q
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(q.proposed_builders) AS b
      WHERE b->>'userId' = ANY(${ids})
    )
  `)) as unknown as { rows: Array<{ n: number }> };
  const qn = quotes.rows[0]?.n ?? 0;
  if (qn > 0) {
    found.push(`cooperative_quotes.proposed_builders (${qn} quote${qn === 1 ? "" : "s"})`);
  }

  const textRefs: Array<[string, string]> = [
    ["revenue_splits", "recipient_id"],
    ["cooperative_receipts", "recipient_id"],
  ];
  for (const [table, column] of textRefs) {
    const r = (await db.execute(sql`
      SELECT count(*)::int AS n
      FROM ${sql.identifier(table)}
      WHERE ${sql.identifier(column)} = ANY(${ids})
    `)) as unknown as { rows: Array<{ n: number }> };
    const n = r.rows[0]?.n ?? 0;
    if (n > 0) found.push(`${table}.${column} (${n} row${n === 1 ? "" : "s"})`);
  }

  return found;
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

  // Soft references first. Postgres cannot refuse these, so if the
  // delete runs with one outstanding it corrupts quietly rather than
  // failing loudly — which is the one outcome this page exists to
  // prevent.
  const soft = await softReferences(ids);
  if (soft.length > 0) {
    return {
      ok: false,
      message:
        `Refusing. Real work still references ${soft.length === 1 ? "one of these rows" : "these rows"}: ` +
        `${soft.join(", ")}. None of those are foreign keys, so the database would have ` +
        `allowed the delete and left the reference dangling. Reassign or clear them first.`,
    };
  }

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
  try {
    await db.transaction(async (tx) => {
      for (const d of deps.rows) {
        // accounts and sessions are empty for every candidate by
        // definition — that is what made them candidates.
        if (d.table_name === "accounts" || d.table_name === "sessions") continue;
        // Identifiers come from information_schema, not from input, so
        // there is no user-supplied string in this statement. The ids
        // are still bound rather than interpolated.
        const res = await tx.execute(
          sql`DELETE FROM ${sql.identifier(d.table_name)}
              WHERE ${sql.identifier(d.column_name)} = ANY(${ids})`,
        );
        const n = (res as unknown as { rowCount?: number }).rowCount ?? 0;
        if (n > 0) cleared.push(`${d.table_name}.${d.column_name}=${n}`);
      }
      await tx.execute(sql`DELETE FROM users WHERE id = ANY(${ids})`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message:
        `Rolled back, nothing changed. ${message}. A foreign key refused the ` +
        `delete, which means something real references a fixture row. Worth ` +
        `looking at rather than forcing.`,
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
