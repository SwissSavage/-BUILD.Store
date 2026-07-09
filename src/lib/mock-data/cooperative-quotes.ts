/**
 * Cooperative Quotes — client-facing quote sheets, the interactive
 * replacement for the old Google Doc quote sheets FM used to send.
 *
 * Distinct from `MOCK_QUOTES` in `./quotes.ts` — that store holds
 * `QuoteSheet` entries, which are Members' bids on RFPs. This store
 * holds `CooperativeQuote` entries, which are the OUTBOUND proposals
 * FM sends to clients: proposed crew, scope, pricing, magic-link
 * gated at /quotes/[clientToken].
 *
 * Sandbox seeds two quotes tied to existing MOCK_PROJECTS so the
 * flip-reveal + TalentHand surfaces have live data to render.
 * Production replaces with a Drizzle `cooperative_quotes` table +
 * admin authoring flow.
 *
 * Editorial voice for the per-member relevance narratives: first-
 * name basis, "why this person for this project" in one line, no
 * jargon. What you'd say on the call, written down.
 */
import type { CooperativeQuote } from "@/lib/types";

export const MOCK_COOPERATIVE_QUOTES: CooperativeQuote[] = [
  {
    id: "quote_p001_urlmedia",
    clientToken: "q_urlmedia_brand_film_2026",
    projectId: "p_001",
    clientDisplayName: "URL Media",
    // Order: recommended lead first. Client can choose otherwise.
    proposedMemberIds: ["u_bbg", "u_sunny", "u_bayu"],
    memberRelevance: {
      u_bbg:
        "BBG carries the FM voice through every read. The film needs a director whose creative read is on the exact tone URL Media has been building — that's him.",
      u_sunny:
        "Sunny's brand direction chops mean the film ships with a visual system, not just a piece. When URL Media wants to spin it into stills, cutdowns, and OOH, the assets are already coherent.",
      u_bayu:
        "Bayu handles the interactive companion — landing microsite for the launch. His brand systems work translates the film's design language into an owned digital surface.",
    },
    scope: {
      summary:
        "Three-minute hero film with Afrofuturist direction, plus social cutdowns and a launch microsite. Delivery in 8 weeks from kickoff.",
      deliverables: [
        "Hero film — 3 minutes, delivered in ProRes + H.264 with subtitle track",
        "Social cutdowns — 60s, 30s, 15s for Instagram + TikTok",
        "Launch microsite — single-page interactive with the film + credits",
        "Stills package — 20 high-res frames selected + color-graded from the shoot",
        "Behind-the-scenes documentary — 8-minute companion piece for URL Media's own channels",
      ],
      timeline:
        "8 weeks from kickoff — 2 weeks pre-production, 3 weeks production + shoot, 3 weeks post + microsite.",
    },
    pricing: {
      baseAmount: 45000,
      talentSplit: 85,
      operationsSplit: 15,
    },
    status: "sent",
    sentAt: "2026-07-08T14:30:00Z",
    viewedAt: null,
    decidedAt: null,
    createdAt: "2026-07-08T13:00:00Z",
    createdByUserId: "u_jamar",
    selectedLeadUserId: null,
  },
  {
    id: "quote_p002_dcg",
    clientToken: "q_dcg_erc6551_audit",
    projectId: "p_002",
    clientDisplayName: "Direct Connect Global",
    proposedMemberIds: ["u_tolgay"],
    memberRelevance: {
      u_tolgay:
        "Tolgay wrote the ERC-6551 primitive that FM's own canonization system runs on. Your vault migration is exactly the kind of audit he'd do for us internally — same rigor, zero context transfer.",
    },
    scope: {
      summary:
        "Audit of existing ERC-6551 token-bound account implementation, propose a multisig-compatible migration path, deliver a written report + reference migration contracts.",
      deliverables: [
        "Written audit report — vulnerabilities, gas-optimization opportunities, upgrade paths",
        "Reference migration contracts — Solidity implementing the recommended multisig-compatible approach",
        "Test suite — Foundry-based, covering the migration path end-to-end",
        "Deployment guide — step-by-step for your engineering team to execute the migration",
      ],
      timeline:
        "4 weeks from kickoff — 2 weeks audit + report, 2 weeks migration contract + tests.",
    },
    pricing: {
      baseAmount: 28000,
      talentSplit: 85,
      operationsSplit: 15,
    },
    status: "viewed",
    sentAt: "2026-07-02T10:00:00Z",
    viewedAt: "2026-07-03T16:45:00Z",
    decidedAt: null,
    createdAt: "2026-07-02T09:00:00Z",
    createdByUserId: "u_jamar",
    selectedLeadUserId: null,
  },
];

/** Look up a quote by its client-facing tokenized slug. */
export function findCooperativeQuote(
  token: string,
): CooperativeQuote | null {
  return (
    MOCK_COOPERATIVE_QUOTES.find((q) => q.clientToken === token) ?? null
  );
}
