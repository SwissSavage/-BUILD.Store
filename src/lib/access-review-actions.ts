/**
 * Access review — SOC 2 CC5.3 (least privilege) + ISO 27001 A.9.2
 * (user access management) evidence path.
 *
 * A quarterly ritual: an admin walks through the list of admin-flagged
 * users and either confirms each is still needed, or revokes the flag.
 * The completion of the review is itself an audit entry (verb
 * `config.access_reviewed`) — that record is what the auditor asks for
 * during a Type II observation window.
 *
 * Revocation clears `users.is_admin`. Until 2026-08-30 it flipped the
 * field on an in-memory fixture object, so the audit log recorded a
 * revocation that had not happened — the target kept admin access and
 * the record said otherwise. That is the worst possible failure for a
 * control whose entire output is the record.
 *
 * Still to come: scoped-role revocation (drop finance_admin /
 * membership_admin / moderation_admin individually) rather than one
 * boolean.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getAdminUsers, getUserById } from "@/lib/readers/users";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

/**
 * Admin flips another admin's flag to false during access review.
 * Cannot self-revoke — the reviewing admin must retain access to
 * complete the review record.
 */
export async function revokeAdminFlag(formData: FormData) {
  const reviewer = await requireAdmin();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!targetId) throw new Error("targetId is required");
  if (targetId === reviewer.id) {
    throw new Error(
      "You cannot revoke your own admin flag mid-review. Ask another admin to revoke yours if that's the intent.",
    );
  }
  if (reason.length < 10) {
    throw new Error(
      "Reason must be at least 10 characters — access changes are recorded and auditable.",
    );
  }

  const target = await getUserById(targetId);
  if (!target) throw new Error("Target user not found");
  if (!target.isAdmin) {
    throw new Error("Target is not currently an admin.");
  }

  const before = { isAdmin: target.isAdmin };

  // Persist before logging. An audit entry written ahead of a failed
  // update would assert a revocation that never happened, which is
  // exactly the state this control exists to rule out.
  await db
    .update(users)
    .set({ isAdmin: false, updatedAt: new Date().toISOString() })
    .where(eq(users.id, targetId));

  await logAuditEvent({
    actorUserId: reviewer.id,
    actorRoleSnapshot: snapshotActorRole(reviewer),
    action: "user.admin_flag_changed",
    resourceKind: "user",
    resourceId: target.id,
    before,
    after: { isAdmin: false },
    reason,
  });

  revalidatePath("/admin/access-review");
  revalidatePath("/admin");
}

/**
 * Admin records completion of a quarterly access review. The presence
 * of this entry in the audit log is the evidence the auditor asks
 * for — the value is "we walked the list on this date and here's who
 * signed off." Sandbox stores the review as a config action; production
 * additionally writes a durable review-summary artifact to storage
 * (JSON snapshot of every admin's flag + role at the moment of review).
 */
export async function recordAccessReview(formData: FormData) {
  const reviewer = await requireAdmin();
  const summary = String(formData.get("summary") ?? "").trim();
  // The roster snapshot is the substance of the review record — it is
  // what the auditor reads to see who held access on the date it was
  // signed. It has to come from the live table.
  const { users: adminRows } = await getAdminUsers();
  const admins = adminRows.map((u) => ({
    id: u.id,
    handle: u.handle,
    firstName: u.firstName,
  }));

  await logAuditEvent({
    actorUserId: reviewer.id,
    actorRoleSnapshot: snapshotActorRole(reviewer),
    action: "config.access_reviewed",
    resourceKind: "config",
    resourceId: "admin_access_review",
    before: null,
    after: {
      reviewedAt: new Date().toISOString(),
      admins,
      adminCount: admins.length,
    },
    reason: summary.length > 0 ? summary : "Quarterly access review — all flags confirmed in place.",
  });

  revalidatePath("/admin/access-review");
}
