/**
 * Admin member management actions.
 *
 * Every mutation writes an audit-log entry. These are the SOC 2
 * evidence paths for CC5.2 (role separation) + CC5.3 (least privilege)
 * + A.9.2 (user access management) on the day-to-day admin ops side —
 * the /admin/access-review surface handles the quarterly ritual; this
 * module handles the individual state changes.
 *
 * Every action here writes to `users`. They mutated an in-memory
 * fixture until 2026-08-31, which meant tier changes, admin grants,
 * profile visibility and — worst — suspensions all reverted on the
 * next deploy. A suspended member came back with access, and the
 * audit log said they were still suspended.
 * with row-level security enforcing the actor's admin scope.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { getUserById } from "@/lib/readers/users";
import {
  describeBlockers,
  getMemberFootprint,
} from "@/lib/readers/member-footprint";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { MembershipTier } from "@/lib/types";

const VALID_TIERS: MembershipTier[] = [
  "viewer", "partner", "member",
];

function revalidateMemberPaths(handle?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/access-review");
  revalidatePath("/admin/audit-log");
  revalidatePath("/team");
  if (handle) revalidatePath(`/u/${handle}`);
  revalidatePath("/portfolio");
}

/**
 * Admin sets a user's membership tier. Emits audit verb
 * user.membership_tier_changed with before/after snapshot.
 */
export async function setMembershipTier(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  const rawTier = String(formData.get("tier") ?? "").trim() as MembershipTier;
  if (!uid) throw new Error("uid is required");
  if (!VALID_TIERS.includes(rawTier)) {
    throw new Error(`Unknown tier: ${rawTier}`);
  }
  const user = await getUserById(uid);
  if (!user) throw new Error("User not found");
  const previous = user.membershipTier;
  if (previous === rawTier) {
    // No-op — don't pollute the audit log with unchanged writes.
    return;
  }
  await db
    .update(users)
    .set({ membershipTier: rawTier, updatedAt: new Date().toISOString() })
    .where(eq(users.id, uid));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.membership_tier_changed",
    resourceKind: "user",
    resourceId: user.id,
    before: { membershipTier: previous },
    after: { membershipTier: rawTier },
  });

  revalidateMemberPaths(user.handle);
}

/**
 * Admin flips a user's admin flag. Emits audit verb
 * user.admin_flag_changed. Self-flip is blocked so an admin cannot
 * revoke themselves mid-session without a peer confirming the change
 * (matches the pattern in /admin/access-review).
 */
export async function toggleAdminFlag(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) throw new Error("uid is required");
  if (uid === admin.id) {
    throw new Error(
      "You cannot flip your own admin flag. Ask another admin to change yours if that's the intent.",
    );
  }
  const user = await getUserById(uid);
  if (!user) throw new Error("User not found");
  const previous = user.isAdmin;
  const next = !previous;
  await db
    .update(users)
    .set({ isAdmin: next, updatedAt: new Date().toISOString() })
    .where(eq(users.id, uid));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.admin_flag_changed",
    resourceKind: "user",
    resourceId: user.id,
    before: { isAdmin: previous },
    after: { isAdmin: next },
  });

  revalidateMemberPaths(user.handle);
}

/**
 * Admin toggles a user's profilePublic flag. Emits audit verb
 * user.profile_public_toggled. This is the mechanism behind the Chibu
 * "active on paper, no profile info circulation" posture.
 */
export async function toggleProfilePublic(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) throw new Error("uid is required");
  const user = await getUserById(uid);
  if (!user) throw new Error("User not found");
  const previous = user.profilePublic;
  const nextPublic = !previous;
  await db
    .update(users)
    .set({ profilePublic: nextPublic, updatedAt: new Date().toISOString() })
    .where(eq(users.id, uid));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.profile_public_toggled",
    resourceKind: "user",
    resourceId: user.id,
    before: { profilePublic: previous },
    after: { profilePublic: nextPublic },
  });

  revalidateMemberPaths(user.handle);
}

/**
 * Admin suspends a user. Suspension blocks sign-in (auth stub gates
 * on suspendedAt === null) and hides the public profile. Retained
 * per business-records policy even after data-subject erasure so the
 * suspension record persists on the compliance audit.
 *
 * Cannot suspend an active admin (defense-in-depth against a rogue
 * admin trying to lock out peers) — revoke admin flag first.
 */
export async function suspendUser(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!uid) throw new Error("uid is required");
  if (uid === admin.id) {
    throw new Error("You cannot suspend yourself.");
  }
  if (reason.length < 10) {
    throw new Error(
      "Suspension reason must be at least 10 characters — recorded on the audit log.",
    );
  }
  const user = await getUserById(uid);
  if (!user) throw new Error("User not found");
  if (user.isAdmin) {
    throw new Error(
      "Cannot suspend an active admin. Revoke the admin flag first, then suspend.",
    );
  }
  if (user.suspendedAt) {
    throw new Error("User is already suspended.");
  }
  const now = new Date().toISOString();
  // Guarded on still-unsuspended. Suspension blocks sign-in via the
  // Auth.js signIn callback, so a lost write here means a member the
  // cooperative believes is locked out can still sign in.
  const suspended = await db
    .update(users)
    .set({ suspendedAt: now, suspensionReason: reason, updatedAt: now })
    .where(eq(users.id, uid))
    .returning({ id: users.id });
  if (suspended.length === 0) throw new Error("User not found");

  // Kill their live sessions too. Strategy is "database", so a
  // suspended member with an open session stays signed in until it
  // expires unless the rows go.
  await db.delete(sessions).where(eq(sessions.userId, uid));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.suspended",
    resourceKind: "user",
    resourceId: user.id,
    before: { suspendedAt: null },
    after: { suspendedAt: now },
    reason,
  });

  revalidateMemberPaths(user.handle);
}

/**
 * Admin reactivates a suspended user. Clears suspendedAt +
 * suspensionReason and writes user.reactivated audit entry.
 */
export async function reactivateUser(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!uid) throw new Error("uid is required");
  const user = await getUserById(uid);
  if (!user) throw new Error("User not found");
  if (!user.suspendedAt) {
    throw new Error("User is not currently suspended.");
  }
  const previousReason = user.suspensionReason;
  const previousSuspendedAt = user.suspendedAt;
  await db
    .update(users)
    .set({
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, uid));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.reactivated",
    resourceKind: "user",
    resourceId: user.id,
    before: {
      suspendedAt: previousSuspendedAt,
      suspensionReason: previousReason,
    },
    after: { suspendedAt: null, suspensionReason: null },
    reason: note.length > 0 ? note : null,
  });

  revalidateMemberPaths(user.handle);
}

/**
 * Admin permanently deletes an account. No undo.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AT ALL (2026-09-04)
 *
 * It deliberately did not until now. Suspension was the answer to
 * every "remove this person" and mostly still is: it blocks sign-in,
 * hides the profile, and keeps the record, which is what the
 * business-records policy wants.
 *
 * What suspension does not do is remove the row. Jamar had a second
 * viewer account for himself and it was inflating the onboarded count,
 * so the record being retained was the problem rather than the point.
 * Suspending a duplicate does not make it stop being counted.
 *
 * WHY IT IS THIS NARROW
 *
 * The delete has to be safe for the case it was not written for: an
 * admin on the wrong row. So it only fires for an account carrying
 * nothing worth keeping, and "nothing worth keeping" is decided by
 * getMemberFootprint, the same function the page uses to decide whether
 * to render the button. One definition, two callers, so the control and
 * the guard cannot drift.
 *
 * THE PRECONDITIONS, AND WHY EACH ONE
 *
 *  - Not yourself. Same reason you cannot suspend yourself.
 *  - Not an admin. Revoke the flag first, exactly like suspend, so
 *    removing a peer admin takes two deliberate acts.
 *  - Already suspended. This is the real ratchet. Deleting is the
 *    second half of a decision, never the first thing you do to an
 *    account, and a suspended account is already locked out so nobody
 *    is mid-session when the row goes.
 *  - Type the email. The uid is in a hidden field and every row on
 *    /admin/members looks alike. Typing the address is the step that
 *    makes the wrong row impossible rather than unlikely.
 *  - A reason, recorded. The audit entry outlives the user row.
 *
 * WHAT POSTGRES STILL CATCHES
 *
 * Around forty foreign keys to users.id have no onDelete clause, so
 * they refuse the delete rather than cascade. That is a better guard
 * than this function because it cannot fall out of step with the
 * schema. A violation here is not a bug, it is the schema saying the
 * account was not empty after all, so it gets translated into that
 * sentence instead of a 500.
 * ─────────────────────────────────────────────────────────────
 */
export async function deleteMember(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  const typed = String(formData.get("confirmEmail") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!uid) throw new Error("uid is required");
  if (uid === admin.id) {
    throw new Error("You cannot delete your own account.");
  }

  const user = await getUserById(uid);
  if (!user) throw new Error("User not found");

  if (user.isAdmin) {
    throw new Error(
      "Cannot delete an admin account. Revoke the admin flag first, then suspend, then delete.",
    );
  }
  if (!user.suspendedAt) {
    throw new Error(
      "Suspend the account first. Deleting is the second half of that decision, not a shortcut past it.",
    );
  }
  if (typed.toLowerCase() !== user.email.trim().toLowerCase()) {
    throw new Error(
      "The typed address does not match this account. Deletion cancelled.",
    );
  }
  if (reason.length < 10) {
    throw new Error(
      "Deletion reason must be at least 10 characters. It is recorded on the audit log, which outlives the account.",
    );
  }

  // The same check the page used to decide whether to show the button.
  const footprint = await getMemberFootprint(user.id, user.buildTokenBalance);
  if (!footprint.deletable) {
    throw new Error(
      `This account is not empty: ${describeBlockers(footprint)}. ` +
        "Those records cascade off the user row and would be lost. " +
        "Keep it suspended instead.",
    );
  }

  // Snapshot before the row is gone. auditLogEntries.actorUserId and
  // resourceId are plain text columns with no foreign key, so the entry
  // survives the user it describes. That is not an accident.
  const snapshot = {
    id: user.id,
    email: user.email,
    handle: user.handle,
    name:
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      user.displayName ||
      user.handle,
    membershipTier: user.membershipTier,
    createdAt: user.createdAt,
    suspendedAt: user.suspendedAt,
    suspensionReason: user.suspensionReason,
    cascaded: footprint.clears.map((c) => `${c.table}: ${c.count}`),
  };

  let deleted: { id: string }[];
  try {
    deleted = await db
      .delete(users)
      .where(eq(users.id, uid))
      .returning({ id: users.id });
  } catch (err) {
    // 23503 is foreign_key_violation. It means a table this function
    // does not know about is holding a reference, which is the schema
    // correctly refusing. Say so plainly rather than leaking the raw
    // constraint name into a 500 page.
    const code = (err as { code?: string })?.code;
    const detail = (err as { constraint?: string })?.constraint;
    if (code === "23503") {
      throw new Error(
        `This account still has records attached${
          detail ? ` (${detail})` : ""
        }, so the database refused the delete. That means it is not empty. Keep it suspended.`,
      );
    }
    throw err;
  }

  if (deleted.length === 0) {
    // Someone else deleted it between the read and the write. Nothing
    // happened, so nothing is logged.
    throw new Error("User not found. It was already deleted.");
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.deleted",
    resourceKind: "user",
    resourceId: uid,
    before: snapshot,
    after: null,
    reason,
  });

  revalidateMemberPaths(user.handle);

  // The page this was submitted from is now a 404. A destructive action
  // has to leave you somewhere that exists.
  redirect("/admin/members");
}
