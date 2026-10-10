/**
 * An application and an invite for the same person are one event.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-09)
 *
 * Sahtyre applied through the public "join as talent" form and was
 * also invited directly. He accepted the invite, became a member, and
 * his application carried on sitting in triage with Promote to invite
 * and Reject buttons under it. Jamar: "Can we make it so that
 * applications and invites merge if there's crossover? We don't want
 * duplicates."
 *
 * The queue was built on the assumption that every admission starts in
 * it, so the only way out was through it. In practice the two paths run
 * in parallel all the time: someone fills in the form on Tuesday and
 * gets a text from Jamar on Wednesday, in either order. Whichever lands
 * first, the other is now a duplicate of a decision already made.
 *
 * WHY THE EMAIL IS THE KEY
 *
 * It is the only identifier both paths carry. Names are typed twice and
 * spelled differently; the form here reads "Cassidy Howell" where the
 * roster says Sahtyre. Lowercased and trimmed on both sides, because a
 * capital letter is not a different person.
 *
 * WHY CONVERTED AND NOT CLOSED
 *
 * "Converted" is what the queue calls an admission that became a
 * member, which is exactly what happened. Closing it as no-action would
 * record the opposite of the truth: the person did join, and the
 * application is part of why.
 * ─────────────────────────────────────────────────────────────
 */
/*
 * Deliberately NOT a "use server" module.
 *
 * reconcileInboundForNewMember runs inside completeInviteSignup, where
 * the caller is an invitee who is not signed in yet and by definition
 * cannot pass an admin check. Published as a server action it would be
 * a public POST that lets anyone mark inbound rows converted by
 * guessing an email. The guard script caught that on the first run.
 *
 * So the internal helper lives here as an ordinary function, callable
 * only by server code that has already decided the caller earned it.
 * The admin-triggered sweep is a real action and lives in
 * inbound-reconcile-actions.ts behind requireAdmin.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { inboundSubmissions } from "@/db/schema";
import { ADMISSION_KINDS, INBOUND_APPROVED } from "@/lib/inbound-triage";

/** Statuses that still look like a decision is owed. */
export const UNRESOLVED_INBOUND = ["new", "in_triage", "needs_info"] as const;

/**
 * Close out any open admission submission from this email, because the
 * person it was about is now a member.
 *
 * Returns how many rows it resolved. Best-effort by design: a failure
 * here must never block someone from completing their own signup, and
 * the worst case is the duplicate an admin was already looking at.
 */
export async function reconcileInboundForNewMember(input: {
  email: string;
  userId: string;
  reason: string;
}): Promise<number> {
  const email = input.email.trim().toLowerCase();
  if (!email) return 0;

  try {
    const rows = await db
      .select({ id: inboundSubmissions.id, note: inboundSubmissions.triageNote })
      .from(inboundSubmissions)
      .where(
        and(
          // Case-insensitive on the stored side too: these rows are
          // whatever the submitter typed into a form.
          sql`lower(trim(${inboundSubmissions.submitterEmail})) = ${email}`,
          inArray(inboundSubmissions.kind, ADMISSION_KINDS),
          inArray(inboundSubmissions.status, [...UNRESOLVED_INBOUND]),
        ),
      );
    if (rows.length === 0) return 0;

    const now = new Date().toISOString();
    for (const row of rows) {
      // Appended, not replaced. Whatever an admin wrote while triaging
      // is the reasoning behind a decision and outlives the row's
      // status.
      const note = [row.note?.trim(), input.reason].filter(Boolean).join("\n\n");
      await db
        .update(inboundSubmissions)
        .set({
          status: INBOUND_APPROVED,
          linkedResourceId: input.userId,
          deepLinkHref: `/admin/members/${input.userId}`,
          triageNote: note,
          updatedAt: now,
        })
        .where(eq(inboundSubmissions.id, row.id));
    }
    return rows.length;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[inbound] reconcile failed", err);
    return 0;
  }
}
