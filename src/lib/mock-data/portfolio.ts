/**
 * Mock portfolio items — shown on public member profiles (/u/[handle]),
 * the showcase feed, and the admin review surface.
 *
 * REPLACE WITH: `portfolio_items` table queries.
 *
 * Each item carries both the raw submission and the admin-publishing overlay
 * (`publishedAt`, `publishedTitle`, `publishedDescription`, `hideProjectUrl`).
 * Public surfaces should render via `publicPortfolioView()` from `lib/types`
 * to respect redactions. Members always see their own raw submissions.
 *
 * Seed data updated 2026-05-04 to reflect real FM-shipped work from the
 * canon Service Engagement Revenue Log + Catalog curation series. DCG
 * entries retired (engagement walked, see projects-active.md).
 */
import type { PortfolioItem } from "@/lib/types";

export const MOCK_PORTFOLIO: PortfolioItem[] = [
  // Jamar — Future Modern brand system. Public projectUrl hidden (anti-circumvention).
  {
    id: "pf_001",
    userId: "u_jamar",
    title: "Future Modern brand system",
    description:
      "Palette, typography, logo suite, and voice guidelines for the cooperative.",
    imageUrl: null,
    projectUrl: "https://afuturemodern.com",
    industry: "creative-media",
    technologies: ["brand", "identity", "narrative"],
    featured: true,
    createdAt: "2025-11-01T00:00:00Z",
    publishedAt: "2025-11-03T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: true,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Jamar — Catalog Works curation series. FM was the curator; published
  // retrospectives live on Paragraph (formerly Mirror).
  {
    id: "pf_002",
    userId: "u_jamar",
    title: "Catalog Works curated music NFT release series",
    description:
      "Curated a multi-year release series on Catalog featuring underground rap and indie music. Coverage from The Needle Drop, KQED, and Coinbase. Documented retrospectively on the FM Paragraph.",
    imageUrl: null,
    projectUrl: "https://paragraph.com/@future-modern",
    industry: "creative-media",
    technologies: ["curation", "web3", "music"],
    featured: true,
    createdAt: "2022-08-21T00:00:00Z",
    publishedAt: "2022-08-21T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Chibu — $BUILD token + ERC-6551 architecture. Foundational on-chain work.
  {
    id: "pf_003",
    userId: "u_chibu",
    title: "$BUILD token + ERC-6551 architecture",
    description:
      "Token-bound account deployment and treasury multisig design for the cooperative platform.",
    imageUrl: null,
    projectUrl: null,
    industry: "stem",
    technologies: ["solidity", "ERC-6551", "multisig"],
    featured: true,
    createdAt: "2025-09-22T00:00:00Z",
    publishedAt: "2025-09-24T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Aliza — URL Collective editorial. Real engagement; revenue-log confirmed.
  {
    id: "pf_004",
    userId: "u_aliza",
    title: "URL Collective editorial direction",
    description:
      "Long-form editorial pieces and photo direction for an indie media network. Strongest editorial of the year per the client.",
    imageUrl: null,
    projectUrl: null,
    industry: "creative-media",
    technologies: ["editorial", "photo direction", "longform"],
    featured: true,
    createdAt: "2024-11-15T00:00:00Z",
    publishedAt: "2024-12-01T00:00:00Z",
    publishedTitle: null,
    publishedDescription:
      "Long-form editorial pieces and photo direction for an indie media network.",
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Michael — Capital Visitor Center via Isosceles Solutions. Active engagement.
  {
    id: "pf_005",
    userId: "u_michael",
    title: "Strategy + ops for an integrator client",
    description:
      "Delivered scoping and operational planning into a federal-adjacent visitor experience program through an integrator partner.",
    imageUrl: null,
    projectUrl: null,
    industry: "professional-services",
    technologies: ["strategy", "ops", "integrator partnership"],
    featured: false,
    createdAt: "2026-02-01T00:00:00Z",
    publishedAt: "2026-02-15T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Rob — DataXplorer RevOps. Real engagement; Rob delivered the AI data
  // enrichment protocol per the canon revenue log.
  {
    id: "pf_006",
    userId: "u_rob",
    title: "DataXplorer RevOps deployment",
    description:
      "Deployed a proprietary AI data enrichment protocol with a SaaS client; customers responded enthusiastically to the methodology in onboarding.",
    imageUrl: null,
    projectUrl: null,
    industry: "professional-services",
    technologies: ["RevOps", "AI data enrichment", "GTM"],
    featured: false,
    createdAt: "2024-02-09T00:00:00Z",
    publishedAt: "2024-07-15T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Trevor — AI engineer. Pending; admin will publish once production-ready.
  {
    id: "pf_007",
    userId: "u_trevor",
    title: "Retrieval-augmented research agent",
    description:
      "LLM agent over a private corpus with citation-traced answers; deployed on a member-only research surface.",
    imageUrl: null,
    projectUrl: null,
    industry: "stem",
    technologies: ["python", "llm", "retrieval"],
    featured: false,
    createdAt: "2026-02-04T00:00:00Z",
    publishedAt: "2026-02-06T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // BBG — HEEMS DRAKE OBAMA. The diss track that broke the internet.
  {
    id: "pf_008",
    userId: "u_bbg",
    title: "HEEMS DRAKE OBAMA",
    description:
      "Diss track and self-produced music video. Reviewed by The Needle Drop. Released as a 48-hour open-edition NFT through the FM Catalog series.",
    imageUrl: null,
    projectUrl: null,
    industry: "creative-media",
    technologies: ["recording", "production", "music video"],
    featured: true,
    createdAt: "2022-12-16T00:00:00Z",
    publishedAt: "2022-12-20T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Sahtyre — STILL HIGH. Catalog exclusive through FM curation series.
  {
    id: "pf_009",
    userId: "u_sahtyre",
    title: "STILL HIGH",
    description:
      "Wild, woozy exclusive single released through the FM-curated Catalog series.",
    imageUrl: null,
    projectUrl: null,
    industry: "creative-media",
    technologies: ["recording", "songwriting"],
    featured: true,
    createdAt: "2022-10-25T00:00:00Z",
    publishedAt: "2022-10-25T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Jrusalam — MELOTHESIAN. Cohesive long-form release; persona-defining.
  {
    id: "pf_010",
    userId: "u_jrusalam",
    title: "MELOTHESIAN",
    description:
      "Full project. Parable Rap rooted in the cultural inflections of the Bible Belt. Persona-defining release for the Melothesian arc.",
    imageUrl: null,
    projectUrl: "https://open.spotify.com/artist/4KQeFAIlDDUEhTAFMdqifM",
    industry: "creative-media",
    technologies: ["recording", "songwriting", "parable rap"],
    featured: true,
    createdAt: "2018-01-01T00:00:00Z",
    publishedAt: "2018-01-01T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
  // Keyboard Kid — first-ever BasedWorld NFT. Catalog inaugural release.
  {
    id: "pf_011",
    userId: "u_keyboard_kid",
    title: "First-ever BasedWorld NFT",
    description:
      "First BasedWorld release in Catalog's inaugural release campaign. The arc continued with 'Days Past Gone' marking the cutting of his dreads.",
    imageUrl: null,
    projectUrl: null,
    industry: "creative-media",
    technologies: ["production", "recording", "BasedWorld"],
    featured: true,
    createdAt: "2022-09-01T00:00:00Z",
    publishedAt: "2022-09-01T00:00:00Z",
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  },
];
