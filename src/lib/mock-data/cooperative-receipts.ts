/**
 * Cooperative Receipts — post-project client-facing artifacts.
 *
 * The gated proof-of-improvement layer. Instead of shouting economic
 * advantages on the marketing surface, the cooperative shows them as
 * receipts clients receive AFTER settlement. Turns integrity into a
 * retention + CX artifact rather than a landing-page brag.
 *
 * Sandbox seeds two receipts tied to existing closed engagements so
 * the surface can render. Production generates a receipt when a
 * project's settlement completes and dispatches a magic-link to the
 * client contact.
 */
import type { CooperativeReceipt } from "@/lib/types";

export const MOCK_COOPERATIVE_RECEIPTS: CooperativeReceipt[] = [
  {
    id: "receipt_p001",
    clientToken: "rcpt_urlmedia_brand_film_2026",
    projectId: "p_001",
    cashFlowPct: 85,
    timeToMatchHours: 42,
    milestonesHit: 6,
    milestonesTotal: 6,
    crewPeerReviewOvrDelta: 3.2,
    subsequentProjectIds: ["p_002"],
    generatedAt: "2026-06-15T14:30:00Z",
    collaboratorCardTokenId: null,
  },
  {
    id: "receipt_p002",
    clientToken: "rcpt_dcg_erc6551_audit",
    projectId: "p_002",
    cashFlowPct: 85,
    timeToMatchHours: 28,
    milestonesHit: 4,
    milestonesTotal: 4,
    crewPeerReviewOvrDelta: 2.8,
    subsequentProjectIds: [],
    generatedAt: "2026-06-28T10:15:00Z",
    collaboratorCardTokenId: null,
  },
];

export function findCooperativeReceipt(
  token: string,
): CooperativeReceipt | null {
  return (
    MOCK_COOPERATIVE_RECEIPTS.find((r) => r.clientToken === token) ?? null
  );
}
