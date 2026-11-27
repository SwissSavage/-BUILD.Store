/**
 * Build the three rating slots for one engagement. ONE place.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-11-25)
 *
 * Jamar: "the review I left is showing as peer when I'm a project
 * manager."
 *
 * It was. executeBonusDecision resolved each rating through its
 * assigned slot, and the reviews page did not — it had its own line
 * putting every peer_review straight into the peer slot. So the
 * number an admin read on screen was built by different rules than
 * the number that decides the Bonus Margin.
 *
 * That is the same defect as the bonus gate not knowing about the
 * hedge that funds it: two pieces of code computing one thing by
 * different routes, and only one of them maintained. The display was
 * the stale one, which is the worse way round — it is what somebody
 * checks before trusting the result.
 *
 * So every surface calls this. If the slot rules change, they change
 * here, and nothing can quietly disagree.
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customerFeedback } from "@/db/schema";
import { getReviewsForProject, getReviewSlots, safely } from "@/lib/readers";
import { isHalfStep } from "@/lib/ratings";
import { resolveSlot } from "@/lib/review-slots";
import type { RatingSignals } from "@/lib/bonus-reconciliation";

export async function buildRatingSignals(project: {
  id: string;
  assignedMemberIds: string[] | null;
  pmEngagementRating: number | null;
}): Promise<RatingSignals> {
  const [peerReviews, slots, feedback] = await Promise.all([
    safely(() => getReviewsForProject(project.id), []),
    safely(() => getReviewSlots(project.id), new Map<string, "peer" | "pm">()),
    safely(
      () =>
        db
          .select()
          .from(customerFeedback)
          .where(eq(customerFeedback.contextId, project.id)),
      [] as (typeof customerFeedback.$inferSelect)[],
    ),
  ]);

  const contributorIds = new Set(project.assignedMemberIds ?? []);
  const peer: number[] = [];
  const pm: number[] = [];

  for (const r of peerReviews) {
    if (!isHalfStep(r.stars) || !r.reviewerId) continue;
    const slot = resolveSlot({
      userId: r.reviewerId,
      assigned: slots.get(r.reviewerId) ?? null,
      isContributor: contributorIds.has(r.reviewerId),
    });
    if (slot === "peer") peer.push(r.stars);
    else if (slot === "pm") pm.push(r.stars);
  }

  // The settle-screen rating belongs to the PM slot whoever gave it:
  // it is captured as the engagement's own reading rather than as a
  // particular person's.
  if (isHalfStep(project.pmEngagementRating)) pm.push(project.pmEngagementRating);

  return {
    client: feedback.map((f) => f.overallStars).filter(isHalfStep),
    peer,
    pm,
  };
}
