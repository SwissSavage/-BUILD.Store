/**
 * Robots — Next.js 15 file-based convention.
 *
 * Baseline posture: allow all indexing on marketing surfaces, block
 * the auth-gated (app) group and any tokenized surface (receipts,
 * invoices, proposals) since those are addressed by credential, not
 * by URL discovery.
 *
 * Points at the sitemap so search engines discover the tree
 * efficiently rather than crawling every link.
 */
import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Auth-gated member/admin surfaces — nothing here should
          // rank organically. All under (app) but the URL paths are
          // top-level once route groups strip.
          "/admin/",
          "/profile/",
          "/wallet",
          "/activity",
          "/calendar",
          "/dashboard",
          "/notifications",
          "/walkthrough",
          "/locker",
          "/jobs",
          "/orders",

          // Tokenized surfaces — meant for direct-magic-link access
          // only. Never a search-engine-discoverable URL.
          "/quotes/",
          "/receipts/",
          "/invoices/",
          "/proposals/",

          // API routes.
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
