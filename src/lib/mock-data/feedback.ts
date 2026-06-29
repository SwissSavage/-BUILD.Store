/**
 * Beta feedback entries — captured from contextual prompts on member
 * surfaces and from walkthrough step completions.
 *
 * REPLACE WITH: a `feedback_entries` Postgres table. Shape mirrors
 * `FeedbackEntry` in `lib/types.ts`.
 *
 * We denormalize pillar + tier at submit time so historical slice-and-
 * dice keeps working after a user changes pillars or tier. The admin
 * surface at /admin/feedback filters, triages, and replies.
 */
import type { FeedbackEntry } from "@/lib/types";

export const MOCK_FEEDBACK: FeedbackEntry[] = [
  {
    id: "fbk_001",
    userId: "u_aliza",
    surface: "/projects",
    surfaceLabel: "Projects",
    walkthroughStepId: "wts_partner_quote",
    sentiment: "confused",
    note: "The quote form asks for price as free-form text. I wrote '$2k–$4k' and wasn't sure if that was allowed or if you wanted me to pick a number.",
    pillar: "creative-media",
    tier: "partner",
    status: "triaged",
    adminNote:
      "Intentional — ranges are fine, admin normalizes at approval. Could add a hint under the field.",
    triagedBy: "u_jamar",
    triagedAt: "2026-04-22T20:10:00Z",
    createdAt: "2026-04-22T19:05:00Z",
  },
  {
    id: "fbk_002",
    userId: "u_aliza",
    surface: "/dashboard",
    surfaceLabel: "Dashboard",
    walkthroughStepId: "wts_partner_intro",
    sentiment: "positive",
    note: "HubSpot stage on the contract card is great. Answers the 'where's this deal?' question I'd normally DM Jamar about.",
    pillar: "creative-media",
    tier: "partner",
    status: "resolved",
    adminNote: "Log — stage-badge pattern is landing.",
    triagedBy: "u_jamar",
    triagedAt: "2026-04-22T20:12:00Z",
    createdAt: "2026-04-22T18:45:00Z",
  },
  {
    id: "fbk_003",
    userId: "u_jamar",
    surface: "/store",
    surfaceLabel: "Store",
    walkthroughStepId: "wts_member_store",
    sentiment: "blocker",
    note: "Seller application path is hidden — had to hunt. Should be one click from /store header when you don't have a listing yet.",
    pillar: "creative-media",
    tier: "member",
    status: "new",
    adminNote: null,
    triagedBy: null,
    triagedAt: null,
    createdAt: "2026-04-23T10:02:00Z",
  },
  {
    id: "fbk_004",
    userId: "u_chibu",
    surface: "/wallet",
    surfaceLabel: "Wallet",
    walkthroughStepId: null,
    sentiment: "confused",
    note: "What counts as a 'governance' transaction vs an 'admin_grant'? The label is fine but the distinction isn't obvious from the row.",
    pillar: "stem",
    tier: "member",
    status: "new",
    adminNote: null,
    triagedBy: null,
    triagedAt: null,
    createdAt: "2026-04-23T14:31:00Z",
  },
  {
    id: "fbk_005",
    userId: "u_trevor",
    surface: "/showcase",
    surfaceLabel: "Showcase",
    walkthroughStepId: "wts_prospect_showcase",
    sentiment: "positive",
    note: "Reads as 'company I'd want to keep.' That's the question I wanted answered.",
    pillar: "stem",
    tier: "prospect",
    status: "triaged",
    adminNote: "Keep — signal for positioning the showcase at top of funnel.",
    triagedBy: "u_jamar",
    triagedAt: "2026-04-23T09:15:00Z",
    createdAt: "2026-04-23T08:50:00Z",
  },
  {
    id: "fbk_006",
    userId: "u_rob",
    surface: "/profile",
    surfaceLabel: "Profile",
    walkthroughStepId: "wts_partner_payout",
    sentiment: "blocker",
    note: "The payouts section talks about Mercury AND Stripe Connect at the same time. As a new contributor I have no idea which applies to me. Separate it or sequence it.",
    pillar: "professional-services",
    tier: "partner",
    status: "new",
    adminNote: null,
    triagedBy: null,
    triagedAt: null,
    createdAt: "2026-04-23T16:20:00Z",
  },
];
