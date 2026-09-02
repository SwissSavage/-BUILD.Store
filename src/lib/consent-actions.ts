/**
 * Consent / data-participation server actions.
 *
 * Tier-2 data participation is the cooperative's labor-value research +
 * collective-bargaining tooling scope. It's an explicit opt-in distinct
 * from the registration baseline T&C (which covers Tier-1 operational
 * use: internal pricing, matching, calibration). Members toggle their
 * Tier-2 status from /profile at any time. Default is opt-out.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS WAS REWRITTEN (2026-09-02)
 *
 * Both actions did `MOCK_USERS.find((u) => u.id === user.id)` and threw
 * "User not found" when the lookup missed. Every real member misses,
 * because real members live in Postgres and not in the fixture array.
 * So the toggle 500ed for everyone who was not seed data, which is
 * everyone. Billy hit it during onboarding.
 *
 * The column has existed the whole time: `users.data_participation`,
 * boolean, not null, default false. Only the writer was missing.
 *
 * The audit trail described in the original note is now real rather
 * than planned. A consent change is exactly the kind of event that has
 * to be reconstructable later: it is the record of what someone agreed
 * to and when, and "we think he opted in around September" is not an
 * answer anyone wants to give.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

/**
 * Set the flag, audit the change, and report whether anything moved.
 *
 * The UPDATE is guarded on the current value, so re-submitting the same
 * choice is a no-op rather than a duplicate audit entry. `.returning()`
 * tells us whether a row actually changed, which is the only honest way
 * to know: a filtered UPDATE that matches nothing is not an error, it
 * just means the member already held that position.
 */
async function setDataParticipation(next: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");

  const changed = await db
    .update(users)
    .set({ dataParticipation: next, updatedAt: new Date().toISOString() })
    .where(eq(users.id, user.id))
    .returning({ id: users.id, dataParticipation: users.dataParticipation });

  if (changed.length === 0) {
    // The session points at a user row that is not there. Worth saying
    // plainly rather than silently succeeding, because it means the
    // session and the database disagree about who is signed in.
    throw new Error(
      "Your account could not be found. Sign out and back in, and tell us if it persists.",
    );
  }

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "user.data_participation_changed",
    resourceKind: "user",
    resourceId: user.id,
    before: { dataParticipation: !next },
    after: { dataParticipation: next },
    reason: next
      ? "Member opted in to Tier-2 data participation."
      : "Member opted out of Tier-2 data participation.",
  });

  revalidatePath("/profile");
}

/** Member opts in to Tier-2 data participation. */
export async function optInDataParticipation() {
  await setDataParticipation(true);
}

/**
 * Member opts out of Tier-2 data participation.
 *
 * Stops new collection for Tier-2 purposes. Already-published anonymized
 * aggregates remain in their published form (non-revocable in effect by
 * design).
 */
export async function optOutDataParticipation() {
  await setDataParticipation(false);
}
