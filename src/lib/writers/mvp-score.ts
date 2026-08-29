/**
 * MVP score recomputation — derives sub-ratings from real peer reviews
 * and persists the snapshot.
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT CHANGED (2026-08-28)
 *
 * The sandbox version of recomputeSnapshot read `existing.subRatings`
 * and wrote them straight back. It never looked at peer reviews. So a
 * member could receive five reviews and their OVR would not move,
 * because the seeded sub-ratings were the only input and they never
 * changed.
 *
 * Combined with peer reviews being stored in memory, the whole MVP
 * rail was decorative: reviews vanished on deploy, and the score they
 * were supposed to feed ignored them anyway.
 *
 * This computes four of the eight sub-ratings from actual reviews:
 *
 *   craft         → quality
 *   reliability   → reliability
 *   collaboration → collaboration
 *   communication → communication
 *
 * The other four (outcomes, hustle, attendance, referrals_bd) come
 * from signals that are not wired yet: bonus-gate clear rate,
 * inbound response time, meeting minutes, referral conversions. Those
 * carry forward from the existing snapshot rather than being invented,
 * and default to the neutral 70 for a member who has no snapshot yet.
 * ─────────────────────────────────────────────────────────────
 *
 * Expert weighting is preserved: admins and reviewers at OVR 85+ carry
 * 2x. That needs every reviewer's own score, so this loads the full
 * score table once and builds a lookup rather than querying per review.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mvpScores, mvpCompliancePenalties } from "@/db/schema";
import { getReviewsOf, mvpScoreReader } from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import {
  aggregatePeerReviewsIntoSubRating,
  buildSnapshot,
  type ReviewerContext,
} from "@/lib/mvp-score";
import type {
  MvpCompliancePenalty,
  MvpScore,
  MvpSubRating,
} from "@/lib/types";

/** Neutral starting value for a dimension with no signal behind it. */
const NEUTRAL = 70;

const DEFAULT_SUB_RATINGS: Record<MvpSubRating, number> = {
  quality: NEUTRAL,
  outcomes: NEUTRAL,
  reliability: NEUTRAL,
  hustle: NEUTRAL,
  collaboration: NEUTRAL,
  communication: NEUTRAL,
  attendance: NEUTRAL,
  referrals_bd: NEUTRAL,
};

/**
 * Build the reviewer-weight lookup. Loads users and scores once, so a
 * member with twenty reviews costs two queries rather than forty.
 */
async function buildReviewerLookup(): Promise<
  (id: string) => ReviewerContext | null
> {
  const [{ users }, scores] = await Promise.all([
    getAllUsers(),
    mvpScoreReader.all(),
  ]);

  const scoreById = new Map(scores.map((s) => [s.userId, s]));
  const contexts = new Map<string, ReviewerContext>(
    users.map((u) => {
      const score = scoreById.get(u.id);
      return [
        u.id,
        {
          userId: u.id,
          isAdmin: Boolean(u.isAdmin),
          ovr: score?.ovr ?? null,
          // No snapshot yet means provisional, which caps them at
          // standard weight regardless of admin status.
          isProvisional: score?.isProvisional ?? true,
        },
      ];
    }),
  );

  return (id: string) => contexts.get(id) ?? null;
}

/**
 * Recompute and persist one member's MVP snapshot from their peer
 * reviews and active penalties.
 *
 * Returns the new snapshot, or null when the member has no reviews and
 * no existing snapshot — there's nothing meaningful to publish for
 * someone the cooperative hasn't worked with yet, and inventing a 70
 * across the board would imply a track record they don't have.
 */
export async function recomputeMvpScore(
  userId: string,
): Promise<MvpScore | null> {
  const [reviews, existing, reviewerLookup] = await Promise.all([
    getReviewsOf(userId),
    mvpScoreReader.one(eq(mvpScores.userId, userId)),
    buildReviewerLookup(),
  ]);

  if (reviews.length === 0 && !existing) return null;

  const carried = existing?.subRatings ?? DEFAULT_SUB_RATINGS;

  const subRatings: Record<MvpSubRating, number> = {
    ...DEFAULT_SUB_RATINGS,
    ...carried,
    // Peer-derived dimensions. Fall back to whatever was carried
    // forward when nobody has reviewed that dimension yet.
    quality: aggregatePeerReviewsIntoSubRating(
      reviews,
      (r) => r.craft ?? null,
      reviewerLookup,
      carried.quality ?? NEUTRAL,
    ),
    reliability: aggregatePeerReviewsIntoSubRating(
      reviews,
      (r) => r.reliability ?? null,
      reviewerLookup,
      carried.reliability ?? NEUTRAL,
    ),
    collaboration: aggregatePeerReviewsIntoSubRating(
      reviews,
      (r) => r.collaboration ?? null,
      reviewerLookup,
      carried.collaboration ?? NEUTRAL,
    ),
    communication: aggregatePeerReviewsIntoSubRating(
      reviews,
      (r) => r.communication ?? null,
      reviewerLookup,
      carried.communication ?? NEUTRAL,
    ),
  };

  const penaltyRows = (await db
    .select()
    .from(mvpCompliancePenalties)
    .where(
      eq(mvpCompliancePenalties.userId, userId),
    )) as unknown as MvpCompliancePenalty[];

  const snapshot = buildSnapshot({
    userId,
    subRatings,
    penalties: penaltyRows,
    publishedAt: new Date().toISOString(),
    // Provisional standing: derived from review count on first
    // publish, but an admin promote/demote is an explicit decision
    // and must survive the next recompute. Three reviews is the
    // threshold the recognition rails assume.
    isProvisional: existing ? existing.isProvisional : reviews.length < 3,
  });

  await db
    .insert(mvpScores)
    .values({
      userId: snapshot.userId,
      ovr: snapshot.ovr,
      subRatings: snapshot.subRatings,
      activePenalties: snapshot.activePenalties,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      publishedAt: snapshot.publishedAt,
      isProvisional: snapshot.isProvisional,
    })
    .onConflictDoUpdate({
      target: mvpScores.userId,
      set: {
        ovr: snapshot.ovr,
        subRatings: snapshot.subRatings,
        activePenalties: snapshot.activePenalties,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        publishedAt: snapshot.publishedAt,
        isProvisional: snapshot.isProvisional,
      },
    });

  return snapshot;
}

/**
 * Recompute every member who has at least one review. This is what the
 * daily compute job should call.
 *
 * Runs sequentially rather than in parallel: the reviewer-weight
 * lookup depends on other members' scores, so concurrent recomputes
 * would read each other's half-written state.
 */
export async function recomputeAllMvpScores(): Promise<{
  recomputed: number;
}> {
  const { users } = await getAllUsers();
  let recomputed = 0;
  for (const u of users) {
    const result = await recomputeMvpScore(u.id);
    if (result) recomputed += 1;
  }
  return { recomputed };
}


/**
 * Admin override of a single sub-rating.
 *
 * Four dimensions (quality, reliability, collaboration, communication)
 * are derived from peer reviews and will be recalculated on the next
 * recompute, so an override there is temporary by design. The other
 * four carry forward and an override sticks until changed again.
 *
 * Returns the resulting snapshot.
 */
export async function setSubRating(
  userId: string,
  key: MvpSubRating,
  value: number,
): Promise<MvpScore | null> {
  const existing = await mvpScoreReader.one(eq(mvpScores.userId, userId));
  if (!existing) return null;

  const merged = { ...existing.subRatings, [key]: Math.round(value) };

  await db
    .update(mvpScores)
    .set({ subRatings: merged })
    .where(eq(mvpScores.userId, userId));

  // Recompute so the OVR reflects the new sub-rating immediately
  // rather than waiting for the daily job.
  return recomputeMvpScore(userId);
}

/**
 * Admin promote/demote off or onto provisional standing.
 *
 * Written directly rather than through recompute, because recompute
 * treats an existing flag as an admin decision to preserve. Going
 * through it here would be circular.
 */
export async function setProvisional(
  userId: string,
  isProvisional: boolean,
): Promise<void> {
  await db
    .update(mvpScores)
    .set({ isProvisional })
    .where(eq(mvpScores.userId, userId));
}
