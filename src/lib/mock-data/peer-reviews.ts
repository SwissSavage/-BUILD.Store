/**
 * Peer review mock data (Phase 2.7 sandbox).
 *
 * Seeded against completed multi-person engagements:
 *   - p_003 (GTM B2B MSP contract, Rob + Michael)
 *   - p_103 (Governance tooling internal, Chibu + Trevor)
 *
 * Each contributor on a multi-person team is expected to submit one
 * review per teammate. Sandbox seeds a partial state so the surface
 * has both completed and outstanding reviews to render.
 *
 * REPLACE WITH: `peer_reviews` Drizzle table. Unique
 * (contextKind, contextId, reviewerId, revieweeId) — no double rating.
 */
import type { PeerReview } from "@/lib/types";

export const MOCK_PEER_REVIEWS: PeerReview[] = [
  // ── p_003 (contract, Rob + Michael) — both directions submitted
  {
    id: "pr_001",
    contextKind: "contract",
    contextId: "p_003",
    reviewerId: "u_rob",
    revieweeId: "u_michael",
    stars: 5,
    collaboration: 5,
    craft: 5,
    reliability: 5,
    prose:
      "Michael ran the operational scorecard end-to-end and pulled in regional benchmarks I didn't know existed. Decisive on scope, never made me chase. Pair again, no hesitation.",
    createdAt: "2026-04-20T15:30:00Z",
  },
  {
    id: "pr_002",
    contextKind: "contract",
    contextId: "p_003",
    reviewerId: "u_michael",
    revieweeId: "u_rob",
    stars: 4,
    collaboration: 5,
    craft: 4,
    reliability: 4,
    prose:
      "Rob's market selection memo was the spine of the whole deliverable. Caught one timeline slip mid-week — owned it, recovered it, no drama. Strong builder.",
    createdAt: "2026-04-21T10:12:00Z",
  },

  // ── p_103 (internal, Chibu + Trevor) — only Chibu has reviewed Trevor;
  //    Trevor's review of Chibu is still outstanding so the surface can
  //    render the "you owe a review" prompt.
  {
    id: "pr_003",
    contextKind: "internal_project",
    contextId: "p_103",
    reviewerId: "u_chibu",
    revieweeId: "u_trevor",
    stars: 4,
    collaboration: 4,
    craft: 5,
    reliability: 4,
    prose:
      "Trevor's voting-weight prototype was tight — clean Solidity, sane gas profile. Comms on standups were lighter than I'd want for a longer engagement, but for a prototype sprint it landed.",
    createdAt: "2026-04-23T19:45:00Z",
  },
];

/**
 * Reviews where this user is the REVIEWEE. Used by the public-to-members
 * profile surface for aggregate display.
 */
export function reviewsForUser(userId: string): PeerReview[] {
  return MOCK_PEER_REVIEWS.filter((r) => r.revieweeId === userId).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * Reviews this user has WRITTEN. Used to compute "you've already
 * reviewed Michael" state on the project detail page.
 */
export function reviewsByUser(userId: string): PeerReview[] {
  return MOCK_PEER_REVIEWS.filter((r) => r.reviewerId === userId);
}

/**
 * Has this reviewer already reviewed this reviewee on this project?
 * Drives the "submitted ✓" vs "form" branch on the peer-review surface.
 */
export function hasReviewed(
  contextId: string,
  reviewerId: string,
  revieweeId: string,
): boolean {
  return MOCK_PEER_REVIEWS.some(
    (r) =>
      r.contextId === contextId &&
      r.reviewerId === reviewerId &&
      r.revieweeId === revieweeId,
  );
}

/**
 * Aggregate the four star fields into a single mean for the
 * profile-card display. Returns null if the user has no reviews — UI
 * should render "no peer reviews yet" rather than 0★.
 */
export function aggregateRating(userId: string): {
  mean: number;
  count: number;
  collaboration: number;
  craft: number;
  reliability: number;
} | null {
  const rs = reviewsForUser(userId);
  if (rs.length === 0) return null;
  const sum = (key: keyof PeerReview) =>
    rs.reduce((acc, r) => acc + Number(r[key]), 0) / rs.length;
  return {
    mean: sum("stars"),
    count: rs.length,
    collaboration: sum("collaboration"),
    craft: sum("craft"),
    reliability: sum("reliability"),
  };
}
