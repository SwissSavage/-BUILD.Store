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
import { getEngagementRoles } from "@/lib/readers";
import { reviewGateState } from "@/lib/readers/review-rounds";
import {
  REVIEW_AXES,
  axesFor,
  type ReviewAxis,
} from "@/lib/engagement-roles";
import { checkReasons, parseHalfStep, pruneReasons } from "@/lib/ratings";
import { recomputeMvpScore } from "@/lib/writers/mvp-score";

export interface AdminReviewResult {
  ok: boolean;
  message: string;
}

/*
 * Scale parsing lives in lib/ratings. Half-steps 2..10, null for a
 * deliberate skip, and the reason rule enforced here rather than
 * trusted to the form — a required field is a suggestion once the
 * request leaves the browser.
 */

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

  // ── Scope, enforced rather than merely hidden ───────────────
  //
  // The form only renders the axes this person's roles cover, but a
  // server action is a public endpoint and hiding a field is not the
  // same as refusing the value. Jamar: "Rob doesn't handle payments,
  // that should be made clear at role assignment not left to be
  // inferred by questions." An out-of-scope answer is dropped here so
  // it cannot reach somebody's record by any route.

  // ── No round, no reviewing ──────────────────────────────────
  //
  // Jamar: "If I'm not configuring a review to reach the customer and
  // related parties there shouldn't be any reviewing happening at
  // all", and nothing until "everyone has the review link/page."
  //
  // Checked here and not only on the surface, because a server action
  // is a public endpoint and a hidden form is not a rule. The reason
  // is passed through so a refusal says which of the three it is: not
  // started, waiting on delivery, or already closed.
  const gate = await reviewGateState(projectId);
  if (!gate.open) {
    const why =
      gate.reason === "awaiting_delivery"
        ? `Waiting on ${gate.waitingOn.length} ${gate.waitingOn.length === 1 ? "person" : "people"} to receive the link. Everyone is asked at the same time.`
        : gate.reason === "closed"
          ? "This review round is closed."
          : "No review round is open for this engagement yet.";
    return { ok: false, message: why };
  }

  const roles = await getEngagementRoles(projectId);
  const allowed = axesFor(roles.get(subjectUserId) ?? []);
  if (allowed.length === 0) {
    return {
      ok: false,
      message:
        "Nobody has said what they did on this engagement yet, so there is nothing fair to ask. Assign roles first.",
    };
  }
  const inScope = (axis: ReviewAxis) =>
    allowed.includes(axis) ? parseHalfStep(formData.get(axis)) : null;

  // ── The reason rule, enforced not requested ─────────────────
  //
  // Any axis answered below the top owes a sentence naming what would
  // have been better. Checked here because the form's required field
  // stops mattering the moment somebody posts directly, and because a
  // score with no articulable reason behind it is exactly what this
  // instrument is meant to filter out.
  //
  // Skips are untouched: null is "did not answer" and owes nothing.
  const scored = REVIEW_AXES.filter((a) => allowed.includes(a.axis)).map(
    (a) => ({
      axis: a.axis as string,
      label: a.label,
      halfSteps: inScope(a.axis),
      reason: String(formData.get(`${a.axis}__reason`) ?? ""),
    }),
  );
  const reasons = checkReasons(scored);
  if (!reasons.ok) return { ok: false, message: reasons.message };

  await db.insert(adminReviews).values({
    id: `arv_${randomUUID()}`,
    projectId,
    subjectUserId,
    reviewerUserId: user.id,
    source: "builder",
    scopeClarity: inScope("scopeClarity"),
    responsiveness: inScope("responsiveness"),
    shieldedFromChurn: inScope("shieldedFromChurn"),
    paidOnTime: inScope("paidOnTime"),
    axisReasons: pruneReasons(scored),
    prose: prose.length > 0 ? prose : null,
  });

  // The whole point: this moves the subject's OVR, through the same
  // sub-ratings a peer review feeds. Jamar: "No admin subratings, the
  // original scores cover all of this." See AXIS_SUB_RATING for the
  // mapping and writers/mvp-score.ts for why the two sources merge
  // rather than one overriding the other.
  //
  // Wrapped for the same reason peer-review-actions wraps it: a
  // scoring failure must not roll back a review somebody already
  // submitted. The daily job picks it up on the next pass.
  try {
    await recomputeMvpScore(subjectUserId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[mvp] recompute after admin review failed", err);
  }

  // Deliberately NOT notifying the subject. A ping saying a review
  // landed, on an engagement with one Builder, identifies the
  // reviewer as surely as signing it would.
  revalidatePath(`/projects/${projectId}`);

  return { ok: true, message: "Recorded. Thanks for saying so." };
}
