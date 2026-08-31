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
 * Note: URL Media and Retired client are CLIENTS, not partners.
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

/**
 * Service partners — orgs FM has signed letters of intent with.
 *
 * Deliberately empty. Every row here renders on the homepage as a
 * public claim that FM has a signed co-delivery relationship with
 * that org. The seven example orgs that used to sit here were
 * fixtures and were making that claim publicly.
 */
export const SERVICE_PARTNERS: ServicePartner[] = [];

/**
 * SaaS partners — software products the cooperative endorses and
 * earns referral revenue from.
 *
 * Empty until a real referral relationship is documented. Giver
 * Marketing previously sat here and has moved to affiliates, per
 * Jamar 2026-08-31: it is not a SaaS product.
 */
export const ECOSYSTEM_PARTNERS: EcosystemPartner[] = [];

/**
 * Product affiliates — real referral relationships only.
 *
 * Trimmed to the three Jamar confirmed 2026-08-31. Do not add an
 * entry here without a relationship that actually exists; this
 * renders publicly on /partners.
 */
export const PRODUCT_AFFILIATES: ProductAffiliate[] = [
  { id: "pa_viim", name: "ViiM", websiteUrl: null, affiliateUrl: null },
  { id: "pa_reach", name: "Reach", websiteUrl: null, affiliateUrl: null },
  { id: "pa_giver", name: "Giver Marketing", websiteUrl: null, affiliateUrl: null },
];
