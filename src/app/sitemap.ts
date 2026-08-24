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
import { MOCK_JOBS } from "@/lib/mock-data/jobs";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";

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
    { url: `${SITE_URL}/community`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Job / contract listing indexes — high priority so their per-item
    // pages surface via the listing crawl.
    { url: `${SITE_URL}/jobs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/contracts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    // Case studies index (task #32) — completed contracts as public
    // portfolio surface for FM as a whole.
    { url: `${SITE_URL}/case-studies`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  /**
   * Per-job posting routes — each open role gets an indexable URL that
   * emits JobPosting JSON-LD. datePosted from the record so Google
   * knows when it went live.
   */
  const jobRoutes: MetadataRoute.Sitemap = MOCK_JOBS
    .filter((j) => j.status === "open")
    .map((j) => ({
      url: `${SITE_URL}/jobs/${j.id}`,
      lastModified: new Date(j.createdAt),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  /**
   * Per-contract routes — RFP-approved open contracts only. Same
   * schema markup as jobs (JobPosting with employmentType=CONTRACTOR)
   * so Google Jobs picks them up alongside FT/PT roles.
   */
  const contractRoutes: MetadataRoute.Sitemap = MOCK_PROJECTS
    .filter(
      (p) =>
        p.kind === "contract" &&
        p.isRfp &&
        p.status === "open" &&
        p.rfpApprovedAt !== null,
    )
    .map((p) => ({
      url: `${SITE_URL}/contracts/${p.id}`,
      lastModified: new Date(p.rfpApprovedAt ?? p.status),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  /**
   * Cohort spotlight pages — one indexable URL per period. Each is a
   * long-tail landing that ranks for the spotlighted builders.
   */
  const cohortRoutes: MetadataRoute.Sitemap = cohortSpotlightsByRecency().map(
    (spotlight) => ({
      url: `${SITE_URL}/cohort/${spotlight.periodKey}`,
      lastModified: new Date(spotlight.publishedAt),
      changeFrequency: "yearly",
      priority: 0.6,
    }),
  );

  /**
   * Per-talent public profile routes (task #31) — /u/[handle] for
   * every member with profilePublic=true. Emits Person JSON-LD +
   * portfolio CreativeWork entries so search indexes each talent as
   * a discoverable entity.
   */
  const talentRoutes: MetadataRoute.Sitemap = MOCK_USERS
    .filter((u) => u.profilePublic !== false && !u.suspendedAt)
    .map((u) => ({
      url: `${SITE_URL}/u/${u.handle}`,
      lastModified: new Date(u.updatedAt ?? u.createdAt ?? now),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  /**
   * Per-case-study routes (task #32) — completed contracts as public
   * CreativeWork entries. datePublished stamped from collectedAt so
   * Google knows delivery timing.
   */
  const caseStudyRoutes: MetadataRoute.Sitemap = MOCK_PROJECTS
    .filter(
      (p) =>
        p.kind === "contract" &&
        p.status === "completed" &&
        p.rfpApprovedAt !== null,
    )
    .map((p) => ({
      url: `${SITE_URL}/case-studies/${p.id}`,
      lastModified: new Date(
        p.collectedAt ?? p.rfpApprovedAt ?? p.createdAt ?? now,
      ),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    }));

  return [
    ...staticRoutes,
    ...cohortRoutes,
    ...jobRoutes,
    ...contractRoutes,
    ...talentRoutes,
    ...caseStudyRoutes,
  ];
}
