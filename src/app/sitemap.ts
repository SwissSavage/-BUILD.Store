/**
 * Sitemap — Next.js 15 file-based convention.
 *
 * Enumerates every public marketing surface so search engines can
 * discover the tree without crawling every link. Groups routes by
 * change-frequency intent:
 *   - Marketing chrome (/, /about, /governance, policies): monthly.
 *   - Editorial rails (/articles, /cohort): daily to weekly.
 *   - Per-item routes (cohort periods): weekly.
 *
 * Only public routes ship here — the (app) group is member/admin and
 * not for search-engine indexing. Same reasoning for tokenized
 * surfaces like /receipts/[token] and /invoices/[token] — they're
 * addressed by credential, not by URL discovery.
 *
 * Production posture: this route is edge-cached once per build. As
 * routes stabilize, extend `staticRoutes` and pull dynamic segments
 * from the live data layer.
 */
import type { MetadataRoute } from "next";
import { cohortSpotlightsByRecency } from "@/lib/mock-data/cohort-spotlights";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  /**
   * Static marketing routes — the surfaces that don't take dynamic
   * segments. `priority` skews toward the surfaces we most want
   * indexed first: landing, about, governance, policy set, articles.
   */
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "monthly", priority: 1.0 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/governance`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/policies`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/policies/covenant`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/policies/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/policies/subprocessors`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/trust`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/partners`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/data-use-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/articles`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/cohort`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/whitelist`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/showcase`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  /**
   * Cohort spotlight pages — one indexable URL per period. Each is a
   * long-tail landing that ranks for the spotlighted cooperators.
   */
  const cohortRoutes: MetadataRoute.Sitemap = cohortSpotlightsByRecency().map(
    (spotlight) => ({
      url: `${SITE_URL}/cohort/${spotlight.periodKey}`,
      lastModified: new Date(spotlight.publishedAt),
      changeFrequency: "yearly",
      priority: 0.6,
    }),
  );

  return [...staticRoutes, ...cohortRoutes];
}
