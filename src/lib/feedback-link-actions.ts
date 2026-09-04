/**
 * Admin issues a client questionnaire link.
 *
 * The counterpart to lib/feedback-link-tokens.ts. Kept separate because
 * a "use server" module may only export async functions, and the token
 * module exports constants and a URL builder the pages need.
 *
 * Issuing a link is a credential handed to someone outside the
 * cooperative, so it is admin-only and audit-logged. The audit entry
 * records the contract and expiry, never the token itself: the log is
 * read by more people than should be able to open a client's
 * questionnaire.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import {
  FEEDBACK_LINK_TTL_DAYS,
  issueFeedbackToken,
} from "@/lib/feedback-link-tokens";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export async function issueFeedbackLink(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Pick a contract to issue a link for.");

  const project = await getProjectById(projectId);
  if (!project) throw new Error("Contract not found.");
  if (project.kind !== "contract") {
    throw new Error("The questionnaire rail is for external client contracts.");
  }

  const { expiresAt } = await issueFeedbackToken({
    contextId: projectId,
    contextKind: "contract",
    issuedByUserId: admin.id,
    ttlDays: FEEDBACK_LINK_TTL_DAYS,
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "contract.feedback_link_issued",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    // The token is deliberately absent. Anyone who can read the audit
    // log would otherwise be able to open the client's questionnaire.
    after: { expiresAt, ttlDays: FEEDBACK_LINK_TTL_DAYS },
  });

  revalidatePath(`/admin/contracts/${projectId}/settle`);
}
