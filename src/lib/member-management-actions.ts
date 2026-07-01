/**
 * Admin member management actions.
 *
 * Every mutation writes an audit-log entry. These are the SOC 2
 * evidence paths for CC5.2 (role separation) + CC5.3 (least privilege)
 * + A.9.2 (user access management) on the day-to-day admin ops side —
 * the /admin/access-review surface handles the quarterly ritual; this
 * module handles the individual state changes.
 *
 * Sandbox: mutates MOCK_USERS in place. Production: Drizzle UPDATE
 * with row-level security enforcing the actor's admin scope.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { MembershipTier } from "@/lib/types";

const VALID_TIERS: MembershipTier[] = [
  "viewer",
  "prospect",
  "partner",
  "member",
];

function revalidateMemberPaths(handle?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/access-review");
  revalidatePath("/admin/audit-log");
  revalidatePath("/team");
  if (handle) revalidatePath(`/u/${handle}`);
  revalidatePath("/showcase");
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
  const user = MOCK_USERS.find((u) => u.id === uid);
  if (!user) throw new Error("User not found");
  const previous = user.membershipTier;
  if (previous === rawTier) {
    // No-op — don't pollute the audit log with unchanged writes.
    return;
  }
  user.membershipTier = rawTier;
  user.updatedAt = new Date().toISOString();

  logAuditEvent({
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
  const user = MOCK_USERS.find((u) => u.id === uid);
  if (!user) throw new Error("User not found");
  const previous = user.isAdmin;
  user.isAdmin = !previous;
  user.updatedAt = new Date().toISOString();

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.admin_flag_changed",
    resourceKind: "user",
    resourceId: user.id,
    before: { isAdmin: previous },
    after: { isAdmin: user.isAdmin },
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
  const user = MOCK_USERS.find((u) => u.id === uid);
  if (!user) throw new Error("User not found");
  const previous = user.profilePublic;
  user.profilePublic = !previous;
  user.updatedAt = new Date().toISOString();

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.profile_public_toggled",
    resourceKind: "user",
    resourceId: user.id,
    before: { profilePublic: previous },
    after: { profilePublic: user.profilePublic },
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
  const user = MOCK_USERS.find((u) => u.id === uid);
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
  user.suspendedAt = now;
  user.suspensionReason = reason;
  user.updatedAt = now;

  logAuditEvent({
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
  const user = MOCK_USERS.find((u) => u.id === uid);
  if (!user) throw new Error("User not found");
  if (!user.suspendedAt) {
    throw new Error("User is not currently suspended.");
  }
  const previousReason = user.suspensionReason;
  const previousSuspendedAt = user.suspendedAt;
  user.suspendedAt = null;
  user.suspensionReason = null;
  user.updatedAt = new Date().toISOString();

  logAuditEvent({
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
