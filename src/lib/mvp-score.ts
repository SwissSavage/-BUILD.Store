/**
 * MVP Score computation — cooperative compliance + recognition instrument.
 *
 * Architecture is documented in `future-modern.md` "MVP Score" section.
 * Types live in `lib/types.ts` (`MvpScore`, `MvpSubRating`,
 * `MvpCompliancePenalty`, `MvpStandingBand`).
 *
 * This module is the deterministic compute layer. Sandbox computes from
 * seeded sub-rating inputs in `mock-data/mvp-scores.ts`. Production swap
 * rebuilds inputs from real attribution / peer review / client rating /
 * milestone-hit data on a daily refresh job, then runs the same
 * computeOvr / standingBand pipeline.
 *
 * Visibility helpers also live here (`peerView`, `selfView`) so all
 * surfaces that show MVP data go through one well-named filter.
 */
import {
  MVP_STANDING_LABELS,
  MVP_SUB_RATING_LABELS,
  type MvpCompliancePenalty,
  type MvpScore,
  type MvpStandingBand,
  type MvpSubRating,
  type User,
} from "@/lib/types";

/**
 * Weights for each sub-rating. Sums to 1.00.
 *
 * Aug 2026 rebalance: added Communication (0.10) — clarity, cadence, and
 * keeping the room informed is now scored distinctly from Collaboration
 * (which captures how someone works WITH people; communication captures
 * how they SIGNAL). Reduced hustle (0.18 → 0.14) and each of quality /
 * outcomes / reliability (0.18 → 0.16) to make room without inflating
 * total.
 *
 * Quality includes brand-fit per the 2026-06-29 lock — "clients leave
 * when work is 'not on brand AND untimely'."
 */
export const MVP_WEIGHTS: Record<MvpSubRating, number> = {
  quality: 0.16,
  outcomes: 0.16,
  reliability: 0.16,
  hustle: 0.14,
  collaboration: 0.1,
  communication: 0.1,
  attendance: 0.1,
  referrals_bd: 0.08,
};

/**
 * Period sensitivity helpers. 12-month rolling window with last 3 months
 * weighted 2x. Sandbox doesn't slice real data per-period; production
 * applies this weighting in the daily compute job before the inputs hit
 * `computeOvr`.
 */
export const MVP_PERIOD_DAYS = 365;
export const MVP_RECENT_WINDOW_DAYS = 90;
export const MVP_RECENT_WEIGHT_MULTIPLIER = 2;

/**
 * Per-violation OVR impact. Per locked mechanic, every compliance
 * violation = -9 OVR for 90 days, stacking.
 */
export const MVP_VIOLATION_OVR_IMPACT = -9;
export const MVP_VIOLATION_DURATION_DAYS = 90;

/**
 * OVR threshold bands. Top-10% gate for Champion's Court is applied at
 * the recognition surface (it depends on cohort rank, not just absolute
 * OVR), so this function only encodes the OVR-only band.
 */
export function standingBand(ovr: number): MvpStandingBand {
  if (ovr >= 90) return "champions_court_eligible";
  if (ovr >= 80) return "future_modernist_pool";
  if (ovr >= 75) return "promotion_eligible";
  if (ovr >= 70) return "good_standing";
  if (ovr >= 65) return "probation_review";
  return "removal_accelerated";
}

export function standingLabel(ovr: number): string {
  return MVP_STANDING_LABELS[standingBand(ovr)];
}

/**
 * Compute OVR from sub-ratings (no penalty application yet).
 * Weighted sum, clamped 0-99.
 */
export function computeRawOvr(subRatings: Record<MvpSubRating, number>): number {
  let raw = 0;
  for (const k of Object.keys(MVP_WEIGHTS) as MvpSubRating[]) {
    raw += (subRatings[k] ?? 0) * MVP_WEIGHTS[k];
  }
  return Math.max(0, Math.min(99, Math.round(raw)));
}

/**
 * Count active (non-expired) penalties at `asOf` (default now).
 */
export function activePenaltiesAt(
  penalties: MvpCompliancePenalty[],
  asOf: Date = new Date(),
): MvpCompliancePenalty[] {
  const asOfIso = asOf.toISOString();
  return penalties.filter((p) => p.expiresAt > asOfIso);
}

/**
 * Apply compliance-penalty stack to a raw OVR. Each active penalty
 * subtracts its `ovrImpact` (always -9 in canonical mechanic). OVR
 * clamps to 0-99.
 */
export function applyPenaltyStack(
  rawOvr: number,
  penalties: MvpCompliancePenalty[],
  asOf: Date = new Date(),
): number {
  const active = activePenaltiesAt(penalties, asOf);
  const delta = active.reduce((sum, p) => sum + p.ovrImpact, 0);
  return Math.max(0, Math.min(99, rawOvr + delta));
}

/**
 * Final OVR = raw weighted score from sub-ratings, minus active
 * compliance-penalty stack. Single source of truth.
 */
export function computeOvr(
  subRatings: Record<MvpSubRating, number>,
  penalties: MvpCompliancePenalty[] = [],
  asOf: Date = new Date(),
): number {
  return applyPenaltyStack(computeRawOvr(subRatings), penalties, asOf);
}

/**
 * Build a fresh score snapshot for a user. Sandbox helper; production
 * pipeline builds the same shape from real inputs.
 *
 * Provisional snapshots still carry computed OVR + sub-ratings under the
 * hood so the data accumulates during the provisional window. The
 * `isProvisional` flag gates how the surface RENDERS the snapshot
 * (good-standing only, no OVR/band/Court eligibility surfaced).
 */
export function buildSnapshot(input: {
  userId: string;
  subRatings: Record<MvpSubRating, number>;
  penalties?: MvpCompliancePenalty[];
  publishedAt?: string;
  isProvisional?: boolean;
}): MvpScore {
  const now = input.publishedAt ?? new Date().toISOString();
  const periodEnd = new Date(now);
  const periodStart = new Date(now);
  periodStart.setUTCDate(periodEnd.getUTCDate() - MVP_PERIOD_DAYS);
  const penalties = input.penalties ?? [];
  const ovr = computeOvr(input.subRatings, penalties, new Date(now));
  return {
    userId: input.userId,
    ovr,
    subRatings: input.subRatings,
    activePenalties: activePenaltiesAt(penalties, new Date(now)),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    publishedAt: now,
    isProvisional: input.isProvisional ?? false,
  };
}

/**
 * Self-view: Members see their own OVR + full sub-breakdown + active
 * penalty trail. Returns the snapshot unchanged.
 */
export function selfView(snapshot: MvpScore): MvpScore {
  return snapshot;
}

/**
 * Peer view (Member-to-Member): OVR + active penalty count, NOT the
 * sub-breakdown. Per locked visibility rule — full OVR transparency
 * incl. violation signal, but sub-ratings stay self-only to preserve
 * dignity around individual weak spots.
 */
export interface MvpPeerView {
  userId: string;
  ovr: number;
  band: MvpStandingBand;
  bandLabel: string;
  activePenaltyCount: number;
  publishedAt: string;
}

export function peerView(snapshot: MvpScore): MvpPeerView {
  return {
    userId: snapshot.userId,
    ovr: snapshot.ovr,
    band: standingBand(snapshot.ovr),
    bandLabel: standingLabel(snapshot.ovr),
    activePenaltyCount: snapshot.activePenalties.length,
    publishedAt: snapshot.publishedAt,
  };
}

/**
 * Champion's Court gate — top 10% of Members by OVR AND OVR ≥ 90.
 *
 * Pass in the published snapshots for ALL active Members; this function
 * applies both gates and returns the user IDs that qualify. Provisional
 * snapshots are excluded — provisional members are in "building track
 * record" state and not eligible for any recognition tier until they
 * exit provisional.
 */
export function championsCourtMembers(
  memberSnapshots: MvpScore[],
  members: Pick<User, "id" | "membershipTier">[],
): string[] {
  const memberIds = new Set(
    members
      .filter((u) => u.membershipTier === "member")
      .map((u) => u.id),
  );
  const memberRanked = memberSnapshots
    .filter(
      (s) =>
        memberIds.has(s.userId) && !s.isProvisional && s.ovr >= 90,
    )
    .sort((a, b) => b.ovr - a.ovr);
  if (memberRanked.length === 0) return [];
  const cap = Math.max(1, Math.ceil(memberIds.size * 0.1));
  return memberRanked.slice(0, cap).map((s) => s.userId);
}

/**
 * Label helper for sub-ratings (kept here so all rendering surfaces
 * import from one place).
 */
export function subRatingLabel(k: MvpSubRating): string {
  return MVP_SUB_RATING_LABELS[k];
}

// ──────────────────────────────────────────────────────────────────────
//  Peer-review → sub-rating aggregation (Aug 2026 — expert weighting)
// ──────────────────────────────────────────────────────────────────────

/**
 * Weight applied to a peer review, based on the reviewer's standing.
 * Expert reviews (admins + top-band OVR) carry 2x the weight of a
 * standard-standing review. Provisional / low-standing / no-OVR
 * reviewers get 1x. Formalizes Jamar's ask: "leverage expert peer
 * review as a contributing factor to scoring."
 *
 * Rationale for the specific bands:
 *   - Admins carry 2x — they set the bar for cooperative-facing
 *     conduct and their read is the calibration signal.
 *   - Reviewers with OVR ≥ 85 (top of good-standing / future-modernist
 *     pool + Champion's Court) carry 2x — sustained performers know
 *     what "good" looks like for the cooperative's work.
 *   - Everyone else carries 1x — dignity of the peer-review vote is
 *     preserved even when the reviewer is still building track record.
 *
 * Kept as a pure function so aggregation is deterministic and testable.
 */
export const EXPERT_REVIEW_WEIGHT = 2;
export const STANDARD_REVIEW_WEIGHT = 1;
export const EXPERT_OVR_THRESHOLD = 85;

export interface ReviewerContext {
  userId: string;
  isAdmin: boolean;
  ovr: number | null;
  isProvisional: boolean;
}

export function reviewWeightFor(reviewer: ReviewerContext): number {
  if (reviewer.isProvisional) return STANDARD_REVIEW_WEIGHT;
  if (reviewer.isAdmin) return EXPERT_REVIEW_WEIGHT;
  if (reviewer.ovr !== null && reviewer.ovr >= EXPERT_OVR_THRESHOLD) {
    return EXPERT_REVIEW_WEIGHT;
  }
  return STANDARD_REVIEW_WEIGHT;
}

/**
 * Aggregate a set of peer reviews on a single reviewee into a scalar
 * sub-rating value (0-99, matching MVP_WEIGHTS input scale).
 *
 * Selector picks the dimension off each review (e.g. r => r.communication,
 * r => r.professionalism). Values on the review are 1–5 stars; we
 * rescale to the 0-99 sub-rating scale here (× 19.8, capped).
 *
 * Reviews with a null value on the selected dimension are skipped
 * (legacy rows pre-communication / pre-professionalism).
 *
 * Expert-weighted mean: sum(weight × value) / sum(weight). One 2x
 * expert plus one 1x standard both scoring the same person 5/5 → 5.
 * One 2x expert scoring 4/5 plus one 1x standard scoring 2/5 →
 * (2*4 + 1*2) / 3 = 3.33 (not 3 — expert pulls harder).
 */
export function aggregatePeerReviewsIntoSubRating<T>(
  reviews: Array<T & { reviewerId: string }>,
  selectValue: (r: T) => number | null,
  reviewerLookup: (id: string) => ReviewerContext | null,
  fallback: number = 70,
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of reviews) {
    const raw = selectValue(r);
    if (raw === null || Number.isNaN(raw)) continue;
    const reviewer = reviewerLookup(r.reviewerId);
    if (!reviewer) continue;
    const w = reviewWeightFor(reviewer);
    weightedSum += w * raw;
    totalWeight += w;
  }
  if (totalWeight === 0) return fallback;
  const meanStars = weightedSum / totalWeight;
  // 1–5 → 0-99 rescale. Cap at 99 to match the OVR clamp.
  const scaled = Math.round(meanStars * 19.8);
  return Math.max(0, Math.min(99, scaled));
}
