"use server";

/**
 * Rate the admin who ran the engagement.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-23)
 *
 * Jamar: "I think we should have admin/ project management ratings
 * and portfolios as well."
 *
 * Clients rated the cooperative. Peers rated each other. Nobody rated
 * the person who scoped the work, staffed it, held the client and got
 * everyone paid, in a structure where the executive share exists
 * precisely because somebody did those things.
 *
 * It also left a Builder with no way on the record to say the scope
 * was vague, the client churned unchecked, or the money came late.
 * Those are the three things an admin most affects and the three a
 * peer review cannot express, because Craft and Collaboration do not
 * describe project management.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THE SUBJECT IS NOT TAKEN FROM THE FORM
 *
 * Same lesson as the membership tier application, where applicant and
 * current tier arrived in hidden fields and anyone holding the action
 * id could file in someone else's name. The subject here must be an
 * admin actually on this engagement, so it is checked against
 * projects.adminUserIds rather than trusted from the post.
 *
 * ─────────────────────────────────────────────────────────────
 * ANONYMITY
 *
 * reviewerUserId is stored, as on peer reviews, because an
 * unattributable review cannot be rate-limited or withdrawn and a
 * compliance claim has to be traceable. It is never shown to the
 * subject.
 *
 * That matters more here than in peer review. A Builder is rating the
 * person who decides what work they are offered next, and if the
 * anonymity is not real the ratings are worthless in the pleasant
 * direction. Any surface that reads these owes the same posture:
 * aggregate to the subject, identity to nobody but an admin
 * investigating a compliance flag.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { adminReviews, projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";

export interface AdminReviewResult {
  ok: boolean;
  message: string;
}

/** 1..5, or null when the reviewer skipped the axis. */
function star(v: FormDataEntryValue | null): number | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

/**
 * A Builder rating the admin who ran their engagement.
 *
 * Returns its outcome rather than throwing, for the reason written on
 * ApplyToJobForm: Next strips server-action error messages in
 * production, so "you are not on this engagement" would arrive as "An
 * error occurred in the Server Components render."
 */
export async function submitAdminReview(
  formData: FormData,
): Promise<AdminReviewResult> {
  // Inlined rather than wrapped: check-server-action-auth looks for
  // the gate inside each exported function body.
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to leave a review." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const subjectUserId = String(formData.get("subjectUserId") ?? "").trim();
  const prose = String(formData.get("prose") ?? "").trim();

  if (!projectId || !subjectUserId) {
    return { ok: false, message: "Missing engagement or admin." };
  }
  if (subjectUserId === user.id) {
    return { ok: false, message: "You cannot review yourself." };
  }

  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
      assigned: projects.assignedMemberIds,
      admins: projects.adminUserIds,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, message: "Engagement not found." };

  // Only people who actually worked it, and only once it is done.
  // Rating the person running a job you are still on invites exactly
  // the pressure the anonymity is meant to remove.
  if (project.status !== "completed") {
    return {
      ok: false,
      message: "This opens when the engagement is marked complete.",
    };
  }
  // Contributors AND the other admins on it. Rob rating Jamar is a
  // real and useful review, and requiring the reviewer to be a
  // contributor would have blocked it.
  const onEngagement = new Set([
    ...(project.assigned ?? []),
    ...(project.admins ?? []),
  ]);
  if (!onEngagement.has(user.id)) {
    return { ok: false, message: "You were not on this engagement." };
  }
  // Checked against the record, not trusted from the form.
  if (!(project.admins ?? []).includes(subjectUserId)) {
    return { ok: false, message: "That person did not run this engagement." };
  }

  const existing = await db
    .select({ id: adminReviews.id })
    .from(adminReviews)
    .where(
      and(
        eq(adminReviews.projectId, projectId),
        eq(adminReviews.subjectUserId, subjectUserId),
        eq(adminReviews.reviewerUserId, user.id),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, message: "You have already reviewed them on this one." };
  }

  await db.insert(adminReviews).values({
    id: `arv_${randomUUID()}`,
    projectId,
    subjectUserId,
    reviewerUserId: user.id,
    source: "builder",
    scopeClarity: star(formData.get("scopeClarity")),
    responsiveness: star(formData.get("responsiveness")),
    shieldedFromChurn: star(formData.get("shieldedFromChurn")),
    paidOnTime: star(formData.get("paidOnTime")),
    prose: prose.length > 0 ? prose : null,
  });

  // Deliberately NOT notifying the subject. A ping saying a review
  // landed, on an engagement with one Builder, identifies the
  // reviewer as surely as signing it would.
  revalidatePath(`/projects/${projectId}`);

  return { ok: true, message: "Recorded. Thanks for saying so." };
}
