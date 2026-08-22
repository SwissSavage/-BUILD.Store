/**
 * Bid rate bounds (task #48, simplified 2026-08).
 *
 * Talent sets their own rates. Standing determines whether they get
 * picked for a bid, not what an hour of their expertise is worth —
 * FM is labor-first and rate is the worker's call. This module now
 * enforces only a flat global envelope to catch UI/server-action
 * bugs and truly-out-of-band inputs (missing digits, negative
 * numbers, misplaced decimals). Unusual bids are handled through
 * admin triage on the pending-application queue, not through
 * algorithmic tightening at intake.
 *
 * Prior version had per-standing-band ceilings + compliance-penalty
 * tightening; removed per Jamar's call — "standing has nothing to
 * do with hourly rate." Kept the module + call sites so we have a
 * clean place to reintroduce guardrails later if a specific abuse
 * pattern shows up (e.g. new-signup instantly bidding $2,000/hr on
 * every open contract).
 */
import type { User } from "@/lib/types";

/**
 * Global floor. Below FM's $50 standard so small-task client
 * engagements can accept a lower scoped bid when it fits. Below
 * this is presumed a typo or bug.
 */
const GLOBAL_MIN_RATE = 20;

/**
 * Global ceiling. Wide enough to accommodate rare renowned-mentor
 * tiers (e.g. Rob's ~$1,400/hr contact) with headroom. Above this
 * is presumed a typo or bug — a genuine over-$2k engagement gets
 * admin-mediated rather than talent-submitted.
 */
const GLOBAL_MAX_RATE = 2000;

export interface RateBounds {
  minRate: number;
  maxRate: number;
  /** Human-readable copy for the bid form. */
  reason: string;
}

/**
 * Bounds are the same for everyone. Signature keeps the `user`
 * parameter (and `snapshot` position in call sites) so re-introducing
 * per-user tightening later is a one-file change.
 */
export function computeRateBounds(
  _user: Pick<User, "id" | "membershipTier">,
  _snapshot: unknown = null,
): RateBounds {
  return {
    minRate: GLOBAL_MIN_RATE,
    maxRate: GLOBAL_MAX_RATE,
    reason:
      "Set what your time is worth. FM is labor-first — talent sets their own rates. Admin reviews outliers case-by-case during bid triage.",
  };
}

/**
 * Validate a proposed hourly rate. Returns a friendly error string
 * when the rate is out of bounds; returns null when it's inside.
 * Non-numeric or non-positive inputs fail as expected.
 */
export function validateRateAgainstBounds(
  proposedRate: number,
  bounds: RateBounds,
): string | null {
  if (!Number.isFinite(proposedRate) || proposedRate <= 0) {
    return "Hourly rate must be a positive number.";
  }
  if (proposedRate < bounds.minRate) {
    return `Hourly rate ($${proposedRate}) is below the platform floor of $${bounds.minRate}/hr. If this is a scoped small-task engagement, message admin.`;
  }
  if (proposedRate > bounds.maxRate) {
    return `Hourly rate ($${proposedRate}) exceeds the platform ceiling of $${bounds.maxRate}/hr. Genuine rates above $${bounds.maxRate}/hr are admin-mediated — message admin instead of submitting the bid here.`;
  }
  return null;
}
