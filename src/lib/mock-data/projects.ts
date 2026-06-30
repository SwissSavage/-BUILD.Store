/**
 * Mock projects — split between client CONTRACTS and INTERNAL contributions.
 *
 *   kind="contract" → external client work (one-off deliverables). Surface: /contracts.
 *   kind="internal" → cooperative-owned initiatives where members can opt in
 *                     and contribute. Surface: /projects.
 *
 * REPLACE WITH: `projects` table queries. `isRfp=true` means the record is in
 * the open-RFP stage (members browse + submit); moves through
 * `open -> in_progress -> completed` once awarded/delivered.
 */
import type { Project } from "@/lib/types";

export const MOCK_PROJECTS: Project[] = [
  // ──────────────────────────────────────────────────────────────────────
  //  Contracts — external client work
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "p_001",
    title: "Brand film for indie label launch",
    description:
      "Three-minute hero film + social cuts. Afrofuturist direction. Delivery in 8 weeks.",
    industry: "creative-media",
    skillsRequired: ["direction", "cinematography", "editing", "color"],
    budget: "45000.00",
    status: "open",
    clientId: "client_url_media",
    assignedMemberIds: [],
    kind: "contract",
    isRfp: true,
    rfpApprovedAt: "2026-04-05T00:00:00Z",
    rfpAdminNote: null,
    hubspotStage: "proposal_sent",
    hubspotDealId: "hub_deal_8841",
    collectedRevenue: null,
    collectedAt: null,
    // Jamar owns the URL Media relationship — sole admin on this deal.
    adminUserIds: ["u_jamar"],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    id: "p_002",
    title: "Smart-contract audit — ERC-6551 vault migration",
    description:
      "Audit existing token-bound accounts and propose multisig-compatible migration path.",
    industry: "stem",
    skillsRequired: ["solidity", "security", "ERC-6551"],
    budget: "28000.00",
    status: "open",
    clientId: "client_dcg",
    assignedMemberIds: [],
    kind: "contract",
    isRfp: true,
    rfpApprovedAt: "2026-04-05T00:00:00Z",
    rfpAdminNote: null,
    hubspotStage: "negotiation",
    hubspotDealId: "hub_deal_8852",
    collectedRevenue: null,
    collectedAt: null,
    // Jamar owns DCG. (Prior version listed Chibu as second admin for
    // smart-contract negotiation; removed 2026-06-29 when he went out
    // per bylaws. Tolgay covers any smart-contract review now.)
    adminUserIds: ["u_jamar"],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-04-12T00:00:00Z",
    updatedAt: "2026-04-12T00:00:00Z",
  },
  {
    id: "p_003",
    title: "Go-to-market plan — B2B MSP vertical",
    description:
      "Market selection memo + operational readiness scorecard for a managed services expansion.",
    industry: "professional-services",
    skillsRequired: ["GTM strategy", "market research", "ops"],
    budget: "15000.00",
    status: "completed",
    clientId: "client_dcg",
    assignedMemberIds: ["u_rob", "u_michael"],
    kind: "contract",
    isRfp: false,
    rfpApprovedAt: "2026-03-01T00:00:00Z",
    rfpAdminNote: null,
    hubspotStage: "closed_won",
    hubspotDealId: "hub_deal_8612",
    // Closed and paid — eligible for the revenue split engine + the
    // Phase 2.7 peer + customer feedback rails (multi-person team, so
    // peer review fires; external client, so customer questionnaire fires).
    collectedRevenue: "15000.00",
    collectedAt: "2026-04-18T00:00:00Z",
    // Rob introduced via DCG (also doing delivery — appears in both pools).
    // Jamar is the deal owner. 50/50 admin pool default.
    adminUserIds: ["u_rob", "u_jamar"],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-04-18T00:00:00Z",
  },
  {
    id: "p_004",
    title: "Feature editorial — artist profile series",
    description:
      "Five long-form artist profiles, 2000 words each, with photography direction.",
    industry: "creative-media",
    skillsRequired: ["editorial", "photography", "interviewing"],
    budget: "12000.00",
    status: "completed",
    clientId: "client_url_media",
    assignedMemberIds: ["u_aliza"],
    kind: "contract",
    isRfp: false,
    rfpApprovedAt: "2025-11-01T00:00:00Z",
    rfpAdminNote: null,
    hubspotStage: "closed_won",
    hubspotDealId: "hub_deal_8201",
    // Closed and paid — eligible for the revenue split engine.
    collectedRevenue: "12000.00",
    collectedAt: "2026-02-20T00:00:00Z",
    // Jamar introduced URL Media (per attribution ledger entry att_004).
    adminUserIds: ["u_jamar"],
    // Comp structure example for the settlement bonus-release demo:
    // Talent quoted $8k-$10k asking; base anchored to low end, bonus is
    // the delta to upper end. 5★ client rating on file → gate releases.
    talentBaseAmount: "8000.00",
    talentBonusAmount: "2000.00",
    bonusGate: null, // null → uses CANONICAL_BONUS_GATE
    pmEngagementRating: null, // PM hasn't captured yet; demo will show fallback math
    bonusDecision: "pending",
    bonusDecidedAt: null,
    createdAt: "2025-11-01T00:00:00Z",
    updatedAt: "2026-02-15T00:00:00Z",
  },
  // Pending admin vetting — won't appear on /contracts until approved.
  {
    id: "p_005",
    title: "Documentary short on Brooklyn youth ag programs (raw submit)",
    description:
      "Looking for a director/DP team to produce a 12-minute doc on three urban farming programs. Budget includes shoot days and post. Contact me at maria.vincent@bk-greenroots.org or 718-555-0144 to discuss.",
    industry: "creative-media",
    skillsRequired: ["documentary direction", "DP", "field audio", "edit"],
    budget: "32000.00",
    status: "open",
    clientId: "client_bk_greenroots",
    assignedMemberIds: [],
    kind: "contract",
    isRfp: true,
    rfpApprovedAt: null,
    rfpAdminNote: null,
    hubspotStage: "discovery",
    hubspotDealId: "hub_deal_8910",
    collectedRevenue: null,
    collectedAt: null,
    // Pre-vetting; admin team gets assigned during RFP review.
    adminUserIds: [],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-04-19T00:00:00Z",
    updatedAt: "2026-04-19T00:00:00Z",
  },
  {
    id: "p_006",
    title: "Series A pitch deck overhaul",
    description:
      "Reworking our deck before May roadshow. Need narrative + visual design pass. Decisions through CEO Janelle Park, janelle@arborai.example.",
    industry: "creative-media",
    skillsRequired: ["pitch deck", "narrative", "visual design"],
    budget: "18000.00",
    status: "open",
    clientId: "client_arborai",
    assignedMemberIds: [],
    kind: "contract",
    isRfp: true,
    rfpApprovedAt: null,
    rfpAdminNote: null,
    hubspotStage: "discovery",
    hubspotDealId: "hub_deal_8920",
    collectedRevenue: null,
    collectedAt: null,
    // Pre-vetting; admin team gets assigned during RFP review.
    adminUserIds: [],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-04-20T00:00:00Z",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  Internal — contributions to Future Modern / $BUILD.Store itself
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "p_101",
    title: "$BUILD.Store component library — help wanted",
    description:
      "Standardize Card, Button, Nav, and form primitives into a reusable Tailwind component package. Co-op contribution.",
    industry: "stem",
    skillsRequired: ["React", "Tailwind", "component design"],
    budget: "0.00",
    status: "open",
    clientId: "internal_buildstore",
    assignedMemberIds: [],
    kind: "internal",
    isRfp: true,
    rfpApprovedAt: "2026-04-18T00:00:00Z",
    rfpAdminNote: null,
    hubspotStage: null,
    hubspotDealId: null,
    collectedRevenue: null,
    collectedAt: null,
    // Internal initiative — no commission to split.
    adminUserIds: [],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-04-18T00:00:00Z",
    updatedAt: "2026-04-18T00:00:00Z",
  },
  {
    id: "p_102",
    title: "Member onboarding flow — Creative Media pillar",
    description:
      "Design and storyboard the first-week experience for new Creative Media members. Output: Figma prototype + voiceover.",
    industry: "creative-media",
    skillsRequired: ["UX design", "storyboarding", "voice"],
    budget: "0.00",
    status: "open",
    clientId: "internal_futuremodern",
    assignedMemberIds: [],
    kind: "internal",
    isRfp: true,
    rfpApprovedAt: "2026-04-15T00:00:00Z",
    rfpAdminNote: null,
    hubspotStage: null,
    hubspotDealId: null,
    collectedRevenue: null,
    collectedAt: null,
    // Internal initiative — no commission to split.
    adminUserIds: [],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-04-15T00:00:00Z",
    updatedAt: "2026-04-15T00:00:00Z",
  },
  {
    id: "p_103",
    title: "Governance tooling — token-weighted voting prototype",
    description:
      "Prototype on-chain proposal + voting flow for cooperative decisions. $BUILD balance = weight.",
    industry: "stem",
    skillsRequired: ["solidity", "governance design", "frontend"],
    budget: "0.00",
    // Marked completed (2026-04-22) so the Phase 2.7 peer-review rail
    // has a multi-person internal fixture to render against.
    status: "completed",
    clientId: "internal_buildstore",
    assignedMemberIds: ["u_chibu", "u_trevor"],
    kind: "internal",
    isRfp: false,
    rfpApprovedAt: "2026-03-20T00:00:00Z",
    rfpAdminNote: null,
    hubspotStage: null,
    hubspotDealId: null,
    collectedRevenue: null,
    collectedAt: null,
    // Internal initiative — no commission to split.
    adminUserIds: [],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: "2026-03-20T00:00:00Z",
    updatedAt: "2026-04-22T00:00:00Z",
  },
];
