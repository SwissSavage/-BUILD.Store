/**
 * Annual member canonizations — year-end snapshots minted as ERC-721
 * NFTs with ERC-6551 token-bound accounts. See `future-modern.md`
 * "Annual canonization" section for the principle.
 *
 * Sandbox seeds one prior-year canon (2025) for established members so
 * the /u/[handle] "Cooperative canon" section has cards to display.
 * Production swap drops in the on-chain references (tokenId + TBA
 * address) once the mint cycle runs.
 */
import type { MemberCanonization } from "@/lib/types";

export const MOCK_CANONIZATIONS: MemberCanonization[] = [
  // 2025 canon — established members at the standing they held going
  // into 2026. Tiers are illustrative; production derives from the
  // year-end MVP snapshot.
  {
    id: "canon_2025_jamar",
    userId: "u_jamar",
    year: 2025,
    tier: "champion",
    ovr: 93,
    recognitionIds: [],
    caption:
      "Stood up the unified $BUILD.Store sandbox top-to-bottom. Cooperative architecture, Venture Labor framing, Champion's Court inaugurated.",
    frozenAt: "2025-12-31T23:59:59Z",
    tokenId: null,
    tbaAddress: null,
  },
  {
    id: "canon_2025_bbg",
    userId: "u_bbg",
    year: 2025,
    tier: "future_modernist",
    ovr: 87,
    recognitionIds: [],
    caption:
      "Joined as Head of Creative Strategy. HEEMS DRAKE OBAMA covered by The Needle Drop. Cooperative-equity logic carried into FM voice.",
    frozenAt: "2025-12-31T23:59:59Z",
    tokenId: null,
    tbaAddress: null,
  },
  {
    id: "canon_2025_tolgay",
    userId: "u_tolgay",
    year: 2025,
    tier: "future_modernist",
    ovr: 81,
    recognitionIds: [],
    caption:
      "Wrote the ERC-6551 contracts that power cooperative wallets. Delivered the 2050 Vision Rising Majority Web Manifesto.",
    frozenAt: "2025-12-31T23:59:59Z",
    tokenId: null,
    tbaAddress: null,
  },
  {
    id: "canon_2025_rob",
    userId: "u_rob",
    year: 2025,
    tier: "promotion_eligible",
    ovr: 79,
    recognitionIds: [],
    caption:
      "RevOps Hitman engagements through the year. Sustained role-player band, plugged into multiple client wins.",
    frozenAt: "2025-12-31T23:59:59Z",
    tokenId: null,
    tbaAddress: null,
  },
  {
    id: "canon_2025_trevor",
    userId: "u_trevor",
    year: 2025,
    tier: "good_standing",
    ovr: 74,
    recognitionIds: [],
    caption:
      "AI engineering bench depth. Quiet, reliable, baseline good standing through the year.",
    frozenAt: "2025-12-31T23:59:59Z",
    tokenId: null,
    tbaAddress: null,
  },
  {
    id: "canon_2025_michael",
    userId: "u_michael",
    year: 2025,
    tier: "good_standing",
    ovr: 72,
    recognitionIds: [],
    caption: null,
    frozenAt: "2025-12-31T23:59:59Z",
    tokenId: null,
    tbaAddress: null,
  },
  {
    id: "canon_2025_aliza",
    userId: "u_aliza",
    year: 2025,
    tier: "promotion_eligible",
    ovr: 77,
    recognitionIds: [],
    caption:
      "URL Collective + URL Media editorial work. Held the artist-respecting standard on Creative Media surfaces.",
    frozenAt: "2025-12-31T23:59:59Z",
    tokenId: null,
    tbaAddress: null,
  },
];

export function canonizationsForUser(userId: string): MemberCanonization[] {
  return MOCK_CANONIZATIONS.filter((c) => c.userId === userId).sort(
    (a, b) => b.year - a.year,
  );
}

export function canonizationForYear(
  userId: string,
  year: number,
): MemberCanonization | null {
  return (
    MOCK_CANONIZATIONS.find(
      (c) => c.userId === userId && c.year === year,
    ) ?? null
  );
}

export function canonizationsForYear(year: number): MemberCanonization[] {
  return MOCK_CANONIZATIONS.filter((c) => c.year === year);
}
