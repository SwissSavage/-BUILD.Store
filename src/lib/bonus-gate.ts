/**
 * Bonus-release gate evaluator.
 *
 * Reads the canonical signals defined in `future-modern.md` "Compensation
 * structure" section and returns a structured decision the settlement
 * surface can render and act on.
 *
 * Decision precedence:
 *   1. Client rating within `silenceWindowDays` of engagement close
 *      exists → primary gate. Rating ≥ `clientRatingThreshold` releases;
 *      lower reclaims.
 *   2. No client rating but composite signal present (PM rating + peer
 *      review average) → fallback gate. Composite ≥ `compositeThreshold`
 *      releases; lower reclaims.
 *   3. No client rating AND no composite signal (internal procedural
 *      failure) → default to release. Talent doesn't pay for FM's failure
 *      to do its own admin.
 *
 * Pure function — no mock-data imports. Inputs are passed in. Callers
 * pull from mock data (`feedbackForContext`, `MOCK_PEER_REVIEWS`, etc.)
 * and pass the relevant slices.
 */
import type { BonusReleaseGate, CustomerFeedback, PeerReview } from "@/lib/types";
import { CANONICAL_BONUS_GATE } from "@/lib/types";

export type BonusGateOutcome =
  | "release"
  | "reclaim"
  | "release_no_signal_default";

export interface BonusGateDecision {
  outcome: BonusGateOutcome;
  /** Which signal drove the decision. */
  driver: "client_rating" | "composite_fallback" | "no_signal_default";
  /** Plain-English explanation, admin-facing. */
  explanation: string;
  /** Inputs used; surfaced in the admin UI for transparency. */
  inputs: {
    clientRating: number | null;
    pmRating: number | null;
    peerAverage: number | null;
    composite: number | null;
    threshold: number;
  };
}

/**
 * Evaluate the bonus-release gate.
 *
 * @param feedback   Customer feedback row for this engagement (or null
 *                   if none yet within the silence window).
 * @param peerReviews All peer review rows for this engagement. Average
 *                   computed across `stars` (1-5).
 * @param pmRating   PM engagement rating captured at settlement (1-5),
 *                   or null if not captured.
 * @param gate       Per-contract gate config, or null to use the
 *                   canonical default.
 */
export function evaluateBonusGate(input: {
  feedback: CustomerFeedback | null;
  peerReviews: PeerReview[];
  pmRating: number | null;
  gate?: BonusReleaseGate | null;
}): BonusGateDecision {
  const gate = input.gate ?? CANONICAL_BONUS_GATE;
  const clientRating = input.feedback?.overallStars ?? null;

  const peerAverage = input.peerReviews.length === 0
    ? null
    : input.peerReviews.reduce((s, r) => s + r.stars, 0) /
      input.peerReviews.length;

  // Primary gate: client rating present.
  if (clientRating !== null) {
    const release = clientRating >= gate.clientRatingThreshold;
    return {
      outcome: release ? "release" : "reclaim",
      driver: "client_rating",
      explanation: release
        ? `Client rated the engagement ${clientRating}★ (≥ ${gate.clientRatingThreshold} threshold). Bonus releases to talent.`
        : `Client rated the engagement ${clientRating}★ (below ${gate.clientRatingThreshold} threshold). Bonus reclaims to the engagement recovery pool.`,
      inputs: {
        clientRating,
        pmRating: input.pmRating,
        peerAverage,
        composite: null,
        threshold: gate.clientRatingThreshold,
      },
    };
  }

  // Fallback: internal composite.
  const haveComposite = input.pmRating !== null || peerAverage !== null;
  if (haveComposite) {
    // If one half of the composite is missing, the other carries with
    // weights re-normalized so the total is still 0-5.
    const pmComponent = (input.pmRating ?? 0) * gate.pmWeight;
    const peerComponent = (peerAverage ?? 0) * gate.peerWeight;
    const totalWeight =
      (input.pmRating !== null ? gate.pmWeight : 0) +
      (peerAverage !== null ? gate.peerWeight : 0);
    const composite =
      totalWeight === 0 ? 0 : (pmComponent + peerComponent) / totalWeight;
    const release = composite >= gate.compositeThreshold;
    return {
      outcome: release ? "release" : "reclaim",
      driver: "composite_fallback",
      explanation: release
        ? `No client rating within ${gate.silenceWindowDays}-day window. Internal composite (PM ${gate.pmWeight} + peer ${gate.peerWeight}) = ${composite.toFixed(2)} ≥ ${gate.compositeThreshold}. Bonus releases to talent.`
        : `No client rating within ${gate.silenceWindowDays}-day window. Internal composite = ${composite.toFixed(2)} (below ${gate.compositeThreshold}). Bonus reclaims to the engagement recovery pool.`,
      inputs: {
        clientRating: null,
        pmRating: input.pmRating,
        peerAverage,
        composite,
        threshold: gate.compositeThreshold,
      },
    };
  }

  // No signal anywhere — internal procedural failure, default to release.
  return {
    outcome: "release_no_signal_default",
    driver: "no_signal_default",
    explanation:
      "No client rating and no internal composite signal captured. Per locked policy: talent doesn't pay for FM's failure to do its own admin. Bonus releases by default.",
    inputs: {
      clientRating: null,
      pmRating: null,
      peerAverage: null,
      composite: null,
      threshold: gate.compositeThreshold,
    },
  };
}
