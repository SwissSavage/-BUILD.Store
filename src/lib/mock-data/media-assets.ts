/**
 * Mux content locker — mock assets.
 *
 * REPLACE WITH: a `media_assets` Postgres table + Mux upload pipeline.
 * The shape returned by the query should match `MediaAsset` in
 * `lib/types.ts`. In production, `playbackUrl` is replaced by the Mux
 * playback ID (or signed URL for tier-gated content).
 *
 * Tier-gating note: most beta assets are partner+ on purpose — we want
 * paying tiers to have something to talk about. Trailers / intros open
 * to viewers come later.
 */
import type { MediaAsset } from "@/lib/types";

export const MOCK_MEDIA_ASSETS: MediaAsset[] = [
  {
    id: "ma_001",
    uploaderId: "u_jamar",
    kind: "video",
    title: "Why $BUILD.Store exists — founder note",
    description:
      "12-minute explainer covering the cooperative thesis, the 85/15 split, and why we chose Mercury + Stripe Express over a single rail.",
    industry: "professional-services",
    tierGate: "viewer",
    playbackUrl: "https://example.com/mux/founder-note",
    posterUrl: null,
    duration: "12:04",
    status: "published",
    adminNote: null,
    reviewedBy: "u_jamar",
    reviewedAt: "2026-04-18T20:00:00Z",
    createdAt: "2026-04-15T15:00:00Z",
    updatedAt: "2026-04-18T20:00:00Z",
  },
  {
    id: "ma_002",
    uploaderId: "u_aliza",
    kind: "video",
    title: "Color & post on the Manhattan series — process recording",
    description:
      "Walkthrough of the grade I built for the cookware launch reel — LUTs, mask layers, and where I'd push it differently next time.",
    industry: "creative-media",
    tierGate: "partner",
    playbackUrl: "https://example.com/mux/aliza-color-process",
    posterUrl: null,
    duration: "28:51",
    status: "published",
    adminNote: null,
    reviewedBy: "u_jamar",
    reviewedAt: "2026-04-19T16:30:00Z",
    createdAt: "2026-04-17T09:12:00Z",
    updatedAt: "2026-04-19T16:30:00Z",
  },
  {
    id: "ma_003",
    uploaderId: "u_chibu",
    kind: "video",
    title: "ERC-6551 wallet binding deep-dive",
    description:
      "How the token-bound account flow works end-to-end: the Tolgay contract, the binding sequence, and the gotchas we hit on first integration.",
    industry: "stem",
    tierGate: "member",
    playbackUrl: "https://example.com/mux/chibu-erc6551",
    posterUrl: null,
    duration: "41:18",
    status: "published",
    adminNote: null,
    reviewedBy: "u_jamar",
    reviewedAt: "2026-04-20T22:00:00Z",
    createdAt: "2026-04-19T11:00:00Z",
    updatedAt: "2026-04-20T22:00:00Z",
  },
  {
    id: "ma_004",
    uploaderId: "u_michael",
    kind: "audio",
    title: "Cooperative ops podcast — episode 1",
    description:
      "Pilot episode on the operating model. Interviewing a Future Modern partner about why structure beats branding in year one.",
    industry: "professional-services",
    tierGate: "partner",
    playbackUrl: "https://example.com/mux/coop-ops-ep1",
    posterUrl: null,
    duration: "1:14:22",
    status: "pending_review",
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-04-23T13:00:00Z",
    updatedAt: "2026-04-23T13:00:00Z",
  },
  {
    id: "ma_005",
    uploaderId: "u_trevor",
    kind: "video",
    title: "AI engineer's stack — what I actually use day-to-day",
    description:
      "Tooling tour: editor, orchestration, eval harness. Designed for STEM members who keep asking what 'AI engineer' means in practice.",
    industry: "stem",
    tierGate: "partner",
    playbackUrl: "https://example.com/mux/trevor-stack",
    posterUrl: null,
    duration: "22:09",
    status: "pending_review",
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-04-23T17:45:00Z",
    updatedAt: "2026-04-23T17:45:00Z",
  },
  {
    id: "ma_006",
    uploaderId: "u_rob",
    kind: "video",
    title: "RevOps for a deal-driven cooperative",
    description:
      "Draft cut — needs a new title card and the chapter markers need fixing. Posting for admin eyes only.",
    industry: "professional-services",
    tierGate: "partner",
    playbackUrl: "https://example.com/mux/rob-revops-draft",
    posterUrl: null,
    duration: "18:30",
    status: "draft",
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-04-22T20:14:00Z",
    updatedAt: "2026-04-22T20:14:00Z",
  },
];
