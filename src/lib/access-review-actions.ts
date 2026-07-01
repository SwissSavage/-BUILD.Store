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
 * Sandbox: revocation flips User.isAdmin to false. Production adds
 * scoped-role revocation (drop finance_admin / membership_admin /
 * moderation_admin individually).
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";

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

  const target = MOCK_USERS.find((u) => u.id === targetId);
  if (!target) throw new Error("Target user not found");
  if (!target.isAdmin) {
    throw new Error("Target is not currently an admin.");
  }

  const before = { isAdmin: target.isAdmin };
  target.isAdmin = false;

  logAuditEvent({
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
  const admins = MOCK_USERS.filter((u) => u.isAdmin).map((u) => ({
    id: u.id,
    handle: u.handle,
    firstName: u.firstName,
  }));

  logAuditEvent({
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
