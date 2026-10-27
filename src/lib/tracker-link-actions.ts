/**
 * Admin issues or kills a client tracker link.
 *
 * The counterpart to lib/tracker-link-tokens.ts, and the same split for
 * the same reason as feedback-link-actions: a "use server" module may
 * only export async functions, and the token module exports constants
 * and a URL builder the pages need.
 *
 * Issuing a link hands a credential to someone outside Future Modern,
 * so it is admin-only and audit-logged. The audit entry records the
 * project and expiry and never the token: the log is read by more
 * people than should be able to open a client's tracker.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import {
  TRACKER_LINK_TTL_DAYS,
  issueTrackerToken,
  revokeTrackerTokens,
} from "@/lib/tracker-link-tokens";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export async function issueTrackerLink(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Pick a contract to issue a link for.");

  const project = await getProjectById(projectId);
  if (!project) throw new Error("Contract not found.");

  const { expiresAt } = await issueTrackerToken({
    projectId,
    issuedByUserId: admin.id,
    ttlDays: TRACKER_LINK_TTL_DAYS,
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "contract.tracker_link_issued",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    // The token is deliberately absent, for the same reason as the
    // questionnaire link: anyone who can read the audit log would
    // otherwise be able to open the client's tracker.
    after: { expiresAt, ttlDays: TRACKER_LINK_TTL_DAYS },
  });

  revalidatePath(`/admin/contracts/${projectId}/tracker`);
}

/**
 * Kill the outstanding link without minting a replacement.
 *
 * Separate from reissuing because the reasons are different. Reissue is
 * "they lost the email". Revoke is "that link reached somebody it
 * should not have", and in that case handing out a new one in the same
 * action is the wrong default.
 */
export async function revokeTrackerLink(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Pick a contract to revoke the link for.");

  const killed = await revokeTrackerTokens(projectId);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "contract.tracker_link_revoked",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    after: { revoked: killed },
  });

  revalidatePath(`/admin/contracts/${projectId}/tracker`);
}
