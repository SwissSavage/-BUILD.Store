/**
 * Mock quote sheets — contributor responses to RFPs.
 *
 * Members only submit objective fields (price, timeline, work samples,
 * internal note). Strengths / weaknesses are admin-authored narrative the
 * admin layers in during review. Admin can also override `price`/`timeline`
 * via `approvedPrice` / `approvedTimeline` to strip PII inline. PII is never
 * a rejection reason — admins just remove it.
 *
 * State coverage:
 *   q_001 → approved, admin authored strengths/weaknesses, no overrides
 *   q_002 → approved, admin scrubbed phone number out of price line and
 *           authored a positioning narrative
 *   q_003 → pending admin review (member-submitted, no narrative yet)
 *   q_004 → rejected with note (genuinely vague pricing — not PII)
 *
 * REPLACE WITH: Drizzle inserts/updates against a `quote_sheets` table, plus
 * an attribution-ledger entry on approval + a transactional email to the
 * client when the proposal goes out.
 */
import type { QuoteSheet } from "@/lib/types";

export const MOCK_QUOTES: QuoteSheet[] = [
  {
    id: "q_001",
    projectId: "p_001", // Brand film for indie label launch
    userId: "u_aliza",
    price: "$42,000 fixed (covers shoot, edit, color, deliverables)",
    timeline: "9 weeks: 2 weeks pre-pro, 3 weeks shoot, 4 weeks post",
    workSamples: [
      {
        url: "https://example.com/aliza-reel-2025",
        caption:
          "Director's reel — three brand films and one music video, all edited in-house.",
      },
      {
        url: "https://example.com/aliza-color-case-study",
        caption:
          "Color treatment write-up for a 2025 indie label launch (similar scope).",
      },
    ],
    memberNote: null,
    createdAt: "2026-04-08T14:30:00Z",
    approvedAt: "2026-04-09T11:00:00Z",
    approvedPrice: null,
    approvedTimeline: null,
    strengths:
      "Five years on Afrofuturist-leaning artist work. Comfortable directing first-time on-camera talent. Strong color pipeline — DaVinci-native delivery in HDR.",
    weaknesses:
      "Best paired with an outside DP for any night-exterior shoots — not her strongest range.",
    rejectedAt: null,
    rejectionNote: null,
  },
  {
    id: "q_002",
    projectId: "p_002", // Smart-contract audit
    userId: "u_chibu",
    // Raw includes a personal phone number — admin will strip it via
    // approvedPrice/Timeline override. Never grounds for rejection.
    price:
      "$26,500 (audit + remediation guidance) + $4,000 retest fee — text +1-718-555-0102 to schedule",
    timeline: "6 weeks audit, 2 weeks remediation review",
    workSamples: [
      {
        url: "https://example.com/chibu-erc6551-audit",
        caption:
          "Public audit report from the Dynaco migration (PDF, 22pp).",
      },
    ],
    memberNote:
      "Have a friend at the client side — happy to chat about routing.",
    createdAt: "2026-04-15T09:00:00Z",
    approvedAt: "2026-04-15T16:30:00Z",
    // Admin scrubbed the phone number out of price.
    approvedPrice: "$26,500 (audit + remediation guidance) + $4,000 retest fee",
    approvedTimeline: null,
    strengths:
      "Three prior ERC-6551 audits including the original Dynaco vault migration. Strong working relationship with ImmuneFi for any disclosure coordination, routed through the cooperative.",
    weaknesses:
      "Documentation pass would benefit from a junior teammate — Chibu focuses on the bug surface.",
    rejectedAt: null,
    rejectionNote: null,
  },
  {
    id: "q_003",
    projectId: "p_001", // Same RFP as q_001 — admin will compare
    userId: "u_jamar",
    price: "$48,000 (creative direction + production company partner)",
    timeline: "10 weeks end-to-end",
    workSamples: [
      {
        url: "https://futuremodern.xyz",
        caption: "Future Modern brand system — launch identity case study.",
      },
    ],
    memberNote: null,
    createdAt: "2026-04-19T18:00:00Z",
    approvedAt: null, // pending admin
    approvedPrice: null,
    approvedTimeline: null,
    strengths: null,
    weaknesses: null,
    rejectedAt: null,
    rejectionNote: null,
  },
  {
    id: "q_004",
    projectId: "p_002",
    userId: "u_trevor",
    price: "TBD pending scoping call",
    timeline: "depends on scope",
    workSamples: [
      {
        url: "https://example.com/trevor-audit-summary",
        caption: "Recent audit summary (Polygon vault project).",
      },
    ],
    memberNote: null,
    createdAt: "2026-04-13T12:00:00Z",
    approvedAt: null,
    approvedPrice: null,
    approvedTimeline: null,
    strengths: null,
    weaknesses: null,
    rejectedAt: "2026-04-14T10:15:00Z",
    rejectionNote:
      "Please come back with a fixed-fee or daily-rate ceiling — clients won't move on 'TBD'. A scope range is fine; we just need a number.",
  },
];
