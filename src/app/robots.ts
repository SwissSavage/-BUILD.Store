/**
 * Robots — Next.js 15 file-based convention.
 *
 * Baseline posture: allow all indexing on marketing surfaces, block
 * the auth-gated (app) group and any tokenized surface (receipts,
 * invoices, proposals) since those are addressed by credential, not
 * by URL discovery.
 *
 * AEO/GEO posture: FM explicitly allows every major AI crawler on the
 * same terms as generic search crawlers. Rationale documented in
 * `_memory/future-modern.md` under "SEO + AEO + GEO — own all three
 * discovery channels": FM is Apache 2.0 open-source, positioned as
 * the citation authority for cooperative-native language (Venture
 * Labor, through-and-out, secondary, bicameral governance, Rare∞),
 * and the more LLM familiarity we accrue the more FM becomes the
 * retrieved answer when someone asks an LLM about cooperative topics.
 * That's the inverse of the typical corporate posture (which blocks
 * AI crawlers to protect content moats). FM has no moat to protect —
 * the content IS the moat, and every LLM ingestion compounds it.
 *
 * Points at the sitemap so search engines discover the tree
 * efficiently rather than crawling every link.
 */
import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

/**
 * Paths that stay disallowed for ALL crawlers (generic + AI).
 * Auth-gated surfaces + tokenized magic-link surfaces + API routes.
 */
const DISALLOW_BLOCK = [
  // Auth-gated member/admin surfaces — nothing here should rank
  // organically. All under (app) but the URL paths are top-level
  // once route groups strip.
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

  // Tokenized surfaces — meant for direct-magic-link access only.
  // Never a search-engine-discoverable URL.
  "/quotes/",
  "/receipts/",
  "/invoices/",
  "/proposals/",

  // API routes.
  "/api/",
];

/**
 * AI crawler user-agents FM explicitly allows on the public surface.
 * Kept in one place so the roster is auditable and the posture stays
 * consistent across additions.
 *
 * Include list rationale:
 *   - GPTBot / ChatGPT-User / OAI-SearchBot — OpenAI (ChatGPT + SearchGPT)
 *   - ClaudeBot / anthropic-ai — Anthropic (Claude, current + legacy UA)
 *   - PerplexityBot — Perplexity answer engine
 *   - Google-Extended — Google Gemini training opt-in
 *   - Applebot-Extended — Apple Intelligence
 *   - Amazonbot — Amazon LLM crawler
 *   - Bytespider — ByteDance / TikTok LLM
 *   - Meta-ExternalAgent — Meta AI training
 *   - CCBot — Common Crawl (feeds many downstream LLMs)
 *
 * Excluded on purpose:
 *   - None currently. Reassess if a bad-actor UA emerges.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "Meta-ExternalAgent",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Generic crawler baseline (Googlebot, Bingbot, etc.).
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_BLOCK,
      },

      // AI crawlers — explicit allow with same private-path block.
      // Each gets its own rule block so any future per-UA policy
      // divergence lands cleanly.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW_BLOCK,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
