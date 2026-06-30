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
 * Weights for each sub-rating. Reliability + Quality + Outcomes + Hustle
 * are high-weight (0.18 each); Collaboration + Attendance are medium
 * (0.10 each); Referrals / BD is medium (0.08). Sums to 1.00.
 *
 * Quality includes brand-fit per the 2026-06-29 lock — "clients leave
 * when work is 'not on brand AND untimely'." Quality and Reliability
 * carry equal weight.
 */
export const MVP_WEIGHTS: Record<MvpSubRating, number> = {
  quality: 0.18,
  outcomes: 0.18,
  reliability: 0.18,
  hustle: 0.18,
  collaboration: 0.1,
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
