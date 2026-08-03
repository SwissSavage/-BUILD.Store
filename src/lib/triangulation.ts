/**
 * Triangulated composite math + reserve pool distribution logic.
 *
 * The math that turns three ratings (admin + peer + client) into a
 * single composite that drives bonus release, rebate sizing, and
 * peer-coverage routing. Locked ratios + rules — canonical, not
 * per-contract. See `build-vision.md` governance section for the
 * design rationale + the one-way flow between deals and MVP OVR.
 *
 * Pure functions — no side effects. Server actions consume this
 * module to make decisions; this module never touches storage.
 */
import {
  PEER_COVERAGE_THRESHOLD,
  TRIANGULATION_WEIGHTS,
} from "@/lib/types";

// ────────────────────────────────────────────────────────────────
//  Composite computation
// ────────────────────────────────────────────────────────────────

export interface CompositeRatingsInput {
  /** PM / admin rating (0–5). Null if not captured. */
  adminRating: number | null;
  /** Peer composite (0–5). Null if not captured. */
  peerRating: number | null;
  /** Client rating (0–5). Null if the deal has no external client
   *  and no cooperative-as-client actor filled the role. */
  clientRating: number | null;
}

export interface CompositeComputationResult {
  adminRating: number | null;
  peerRating: number | null;
  clientRating: number | null;
  effectiveWeights: {
    admin: number;
    peer: number;
    client: number;
  };
  weightedComposite: number;
  /** bonusReleaseFraction = weightedComposite / 5, clamped to [0, 1]. */
  bonusReleaseFraction: number;
}

/**
 * Compute the triangulated composite for a single contributor. If a
 * rating is missing, the weight for that signal redistributes
 * pro-rata across the remaining signals so the composite stays on
 * the 0–5 scale.
 *
 * True absence of the client signal (no external client + no
 * cooperative-as-client actor) is the common case for internal
 * work; when that happens, admin+peer redistribute to 0.50/0.50.
 * Any other combination (rare — usually a data-collection gap)
 * follows the same pro-rata rule.
 *
 * Returns weighted composite of 0 when ALL three signals are
 * missing (edge case; effectively means "no rating data → no
 * bonus release").
 */
export function computeTriangulatedComposite(
  input: CompositeRatingsInput,
): CompositeComputationResult {
  const present = {
    admin: input.adminRating !== null,
    peer: input.peerRating !== null,
    client: input.clientRating !== null,
  };

  const canonicalWeights = TRIANGULATION_WEIGHTS;
  const presentWeightSum =
    (present.admin ? canonicalWeights.admin : 0) +
    (present.peer ? canonicalWeights.peer : 0) +
    (present.client ? canonicalWeights.client : 0);

  const effectiveWeights =
    presentWeightSum === 0
      ? { admin: 0, peer: 0, client: 0 }
      : {
          admin: present.admin ? canonicalWeights.admin / presentWeightSum : 0,
          peer: present.peer ? canonicalWeights.peer / presentWeightSum : 0,
          client: present.client
            ? canonicalWeights.client / presentWeightSum
            : 0,
        };

  const weightedComposite =
    (input.adminRating ?? 0) * effectiveWeights.admin +
    (input.peerRating ?? 0) * effectiveWeights.peer +
    (input.clientRating ?? 0) * effectiveWeights.client;

  const bonusReleaseFraction = Math.min(1, Math.max(0, weightedComposite / 5));

  return {
    adminRating: input.adminRating,
    peerRating: input.peerRating,
    clientRating: input.clientRating,
    effectiveWeights,
    weightedComposite: round3(weightedComposite),
    bonusReleaseFraction: round3(bonusReleaseFraction),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ────────────────────────────────────────────────────────────────
//  Rebate sizing (anti-abuse)
// ────────────────────────────────────────────────────────────────

/**
 * Rebate multiplier — how much of the available rebate pool a
 * dissatisfied client is entitled to. Locked at MIN(client
 * shortfall, composite shortfall) so a spiteful low client rating
 * alone yields near-zero rebate unless the triangulation
 * corroborates real dissatisfaction. Kills the client-side gaming
 * vector structurally.
 */
export function computeRebateMultiplier(input: {
  clientRating: number | null;
  weightedComposite: number;
}): number {
  if (input.clientRating === null) {
    // No client signal → no client rebate. The composite alone
    // determines contributor payout downstream; there's no client
    // to compensate.
    return 0;
  }
  const clientShortfall = Math.max(0, (5 - input.clientRating) / 5);
  const compositeShortfall = Math.max(0, (5 - input.weightedComposite) / 5);
  return round3(Math.min(clientShortfall, compositeShortfall));
}

// ────────────────────────────────────────────────────────────────
//  Peer-coverage bonus distribution
// ────────────────────────────────────────────────────────────────

export interface PeerCoverageContributor {
  userId: string;
  weightedComposite: number;
  /** Internal invoice amount for this contributor (drives the
   *  proportional share of any peer-coverage distribution they
   *  receive). String to match Drizzle numeric shape. */
  internalInvoiceAmount: string;
}

export interface PeerCoverageDistribution {
  recipientUserId: string;
  amount: number;
  sharePct: number;
}

/**
 * Distribute an unreleased-bonus pool across same-contract
 * contributors whose composite cleared the coverage threshold.
 * Rewards the actual carrying behavior structurally — no need to
 * explicitly attribute "who covered whom" case-by-case.
 *
 * Returns an empty array when no contributor cleared the threshold
 * OR when the pool is zero. Caller routes empty-return residuals
 * to the Engagement Recovery Pool.
 */
export function distributePeerCoverage(input: {
  poolAmount: number;
  candidates: PeerCoverageContributor[];
}): PeerCoverageDistribution[] {
  if (input.poolAmount <= 0) return [];
  const eligible = input.candidates.filter(
    (c) => c.weightedComposite >= PEER_COVERAGE_THRESHOLD,
  );
  if (eligible.length === 0) return [];

  const totalInternal = eligible.reduce(
    (s, c) => s + Number(c.internalInvoiceAmount),
    0,
  );
  if (totalInternal <= 0) return [];

  return eligible.map((c) => {
    const share = Number(c.internalInvoiceAmount) / totalInternal;
    return {
      recipientUserId: c.userId,
      amount: round2(input.poolAmount * share),
      sharePct: round3(share * 100),
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
