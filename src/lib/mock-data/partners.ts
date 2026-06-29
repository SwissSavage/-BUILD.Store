/**
 * External partner directory. Three tiers exported separately so the
 * public /partners page can render each as its own section without
 * filtering at the call site:
 *
 *   1. SERVICE_PARTNERS    — orgs FM has signed LOIs with for service co-
 *                            delivery (devs, design, film, growth,
 *                            photography).
 *   2. ECOSYSTEM_PARTNERS  — infrastructure relationships (NFT
 *                            marketplaces, access tooling, distribution
 *                            platforms, cultural DAOs).
 *   3. PRODUCT_AFFILIATES  — referral / affiliate-link relationships.
 *
 * Source of truth: `Future Modern/$BUILD SERVICES PORTAL.xlsx` Service
 * Org Partner Funnel + Ecosystem Partners + Product Affiliates tabs
 * (canon snapshot 2026-05-04). Sample data; we'll edit before launch.
 *
 * URL semantics:
 *   - `websiteUrl`     — internal reference. Stored for the admin's
 *                        benefit but NOT rendered on the public page.
 *                        Bare partner domains lose us attribution.
 *   - `affiliateUrl`   — FM-controlled tracked link. Rendered on
 *                        /partners when set. Populate with our UTM-tagged
 *                        or ref-coded URL so click-throughs credit the
 *                        cooperative. Start blank and drop links in as
 *                        we negotiate each one.
 *
 * Note: URL Media and Direct Connect Global are CLIENTS, not partners.
 * They do NOT belong in this file. (Earlier seed had them here; removed
 * 2026-05-04.)
 *
 * REPLACE WITH: a Payload collection or Drizzle table when CMS lands.
 * Keep the three-tier shape so the public page can rerender without
 * code changes.
 */
import type {
  EcosystemPartner,
  ProductAffiliate,
  ServicePartner,
} from "@/lib/types";

export const SERVICE_PARTNERS: ServicePartner[] = [
  {
    id: "sp_brainhub",
    name: "BrainHub",
    capabilities: [
      "Software engineering",
      "Web + frontend development",
      "Blockchain",
      "Technical project management",
    ],
    websiteUrl: null,
    affiliateUrl: null,
    pillarHint: "stem",
    shippedTogether: false,
  },
  {
    id: "sp_chaotic_neutral",
    name: "Chaotic Neutral Studios",
    capabilities: ["Film production"],
    websiteUrl: null,
    affiliateUrl: null,
    pillarHint: "creative-media",
    shippedTogether: false,
  },
  {
    id: "sp_hype_us",
    name: "Hype-US",
    capabilities: [
      "UI / UX design",
      "Frontend development",
      "Web development",
    ],
    websiteUrl: "https://hype-us.com",
    affiliateUrl: null,
    pillarHint: "stem",
    shippedTogether: true,
  },
  {
    id: "sp_lucid",
    name: "Lucid Consulting",
    capabilities: [
      "Pitch decks + sales narrative",
      "Growth + brand",
      "Operations strategy",
      "Fractional co-founder",
    ],
    websiteUrl: "https://lucidconsult.ing",
    affiliateUrl: null,
    pillarHint: "professional-services",
    shippedTogether: false,
  },
  {
    id: "sp_nyoka",
    name: "Nyoka",
    capabilities: [
      "Software engineering",
      "Web + frontend development",
      "Blockchain",
      "Technical project management",
    ],
    websiteUrl: null,
    affiliateUrl: null,
    pillarHint: "stem",
    shippedTogether: false,
  },
  {
    id: "sp_synthax",
    name: "Syndika / Synthax.codes",
    capabilities: [
      "Software engineering",
      "Web + frontend development",
      "Blockchain",
      "Technical project management",
    ],
    websiteUrl: "https://synthax.codes",
    affiliateUrl: null,
    pillarHint: "stem",
    shippedTogether: true,
  },
  {
    id: "sp_underscore_ave",
    name: "Underscore Ave",
    capabilities: ["Photography"],
    websiteUrl: null,
    affiliateUrl: null,
    pillarHint: "creative-media",
    shippedTogether: false,
  },
];

export const ECOSYSTEM_PARTNERS: EcosystemPartner[] = [
  { id: "ep_panvala", name: "Panvala", role: "No-cost fundraising", websiteUrl: null, affiliateUrl: null },
  { id: "ep_collab_land", name: "Collab.land", role: "Token-based access management", websiteUrl: null, affiliateUrl: null },
  { id: "ep_roll", name: "Roll", role: "Social token issuer", websiteUrl: null, affiliateUrl: null },
  { id: "ep_satoshis_closet", name: "Satoshi's Closet", role: "Wallet", websiteUrl: "https://satoshiscloset.com", affiliateUrl: null },
  { id: "ep_diode", name: "Diode", role: "Connectivity", websiteUrl: "https://diode.io", affiliateUrl: null },
  { id: "ep_knownorigin", name: "KnownOrigin", role: "Curated NFT marketplace", websiteUrl: null, affiliateUrl: null },
  { id: "ep_zora", name: "Zora", role: "NFT minting + marketplace", websiteUrl: null, affiliateUrl: null },
  { id: "ep_tiktok", name: "TikTok", role: "Livestreaming", websiteUrl: null, affiliateUrl: null },
  { id: "ep_hello_group", name: "The Hello Group", role: "Touring, digital growth, distribution", websiteUrl: null, affiliateUrl: null },
  { id: "ep_catalog", name: "Catalog", role: "Curated music NFT marketplace", websiteUrl: null, affiliateUrl: null },
  { id: "ep_40acres", name: "40acres DAO", role: "Black crypto cultural space", websiteUrl: null, affiliateUrl: null },
  { id: "ep_fwb", name: "Friends with Benefits", role: "Cultural DAO", websiteUrl: null, affiliateUrl: null },
  { id: "ep_giver", name: "Giver Marketing", role: "Marketing", websiteUrl: null, affiliateUrl: null },
];

export const PRODUCT_AFFILIATES: ProductAffiliate[] = [
  { id: "pa_notion", name: "Notion", websiteUrl: "https://notion.so", affiliateUrl: null },
  { id: "pa_gatsby", name: "Gatsby Events", websiteUrl: "https://gatsby.events", affiliateUrl: null },
  { id: "pa_versabot", name: "VersaBot", websiteUrl: "https://versabot.co", affiliateUrl: null },
  { id: "pa_satoshis", name: "Satoshi's Closet", websiteUrl: "https://satoshiscloset.com", affiliateUrl: null },
  { id: "pa_zenith", name: "Zenith", websiteUrl: "https://zenithai.io", affiliateUrl: null },
  { id: "pa_viim", name: "ViiM", websiteUrl: null, affiliateUrl: null },
  { id: "pa_nanogenesis", name: "NanoGenesis Labs", websiteUrl: null, affiliateUrl: null },
  { id: "pa_livepeer", name: "Livepeer", websiteUrl: "https://livepeer.org", affiliateUrl: null },
  { id: "pa_reach", name: "Reach", websiteUrl: null, affiliateUrl: null },
  { id: "pa_fwb_fest", name: "FWB Fest", websiteUrl: null, affiliateUrl: null },
];
