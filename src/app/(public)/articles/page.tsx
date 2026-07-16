/**
 * /articles — Future Modern editorial hub.
 *
 * Surfaces the FM writing corpus that lives canonically on
 * paragraph.com/@future-modern. Every card links out to the full
 * piece on Paragraph so the canonical URL — and therefore Google's
 * ranking signal — stays with the source. FM benefits from having
 * its own domain index the excerpts + titles + tags, which is where
 * organic search discovery starts anyway.
 *
 * This is the "highlight and centralize what we've already done"
 * surface — the FM release-retrospective series from the mint-era
 * Catalog Works run, plus whatever new writing lands on Paragraph
 * going forward. It's also Web3-native clout without a logo bar:
 * FM was on Paragraph before Paragraph existed (as Mirror), curated
 * on Catalog before Catalog shut down, and holds a real archive of
 * moments in on-chain music history.
 *
 * Sandbox: reads MOCK_ARTICLES. Production: fetches from Paragraph's
 * RSS/oEmbed at build time. Either way this route is static.
 */
import Link from "next/link";
import type { Metadata } from "next";
import {
  MOCK_ARTICLES,
  PARAGRAPH_BASE,
  paragraphUrl,
  type Article,
} from "@/lib/mock-data/articles";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

/**
 * Canonical site URL — mirrors the root layout constant so JSON-LD
 * references stay coherent across the graph. Falls back to the same
 * placeholder domain used elsewhere.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

/** Static-rendered. Pipe reads a build-time array. */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Future Modern's writing corpus: release retrospectives, curatorial notes, and cooperative principles. Piped from paragraph.com/@future-modern, where the pieces live canonically.",
  alternates: {
    canonical: PARAGRAPH_BASE,
  },
  openGraph: {
    type: "website",
    title: "Articles · Future Modern",
    description:
      "Release retrospectives, curatorial notes, and cooperative principles. From paragraph.com/@future-modern.",
    url: "/articles",
  },
};

export default function ArticlesPage() {
  // Sort by publish date descending — freshest first.
  const articles = [...MOCK_ARTICLES].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  /**
   * ItemList JSON-LD — makes each Paragraph piece discoverable via
   * FM's domain even though the canonical URL stays on Paragraph.
   * Each item is a CreativeWork with url + name + datePublished so
   * Google can render carousel-style results when appropriate. Author
   * chain points back to the FM Organization node emitted at the
   * root layout, keeping the graph coherent.
   */
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((article, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "CreativeWork",
        name: article.title,
        url: paragraphUrl(article),
        description: article.excerpt,
        datePublished: article.publishedAt,
        keywords: article.tags.join(", "),
        author: { "@id": `${SITE_URL}#organization` },
        publisher: { "@id": `${SITE_URL}#organization` },
      },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <CardEyebrow>Articles</CardEyebrow>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-tight">
        The Future Modern archive
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-muted">
        Release retrospectives, curatorial notes, and cooperative
        principles. Every piece lives at{" "}
        <a
          href={PARAGRAPH_BASE}
          target="_blank"
          rel="noreferrer"
          className="text-brand-magenta hover:underline"
        >
          paragraph.com/@future-modern
        </a>
        . Clicking a title opens the full piece there.
      </p>

      <div
        className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-sm text-ink-muted"
        role="note"
      >
        <p>
          Paragraph.com is Future Modern&apos;s Web3-native writing
          rail (formerly Mirror; the archive carried over after
          Paragraph acquired Mirror). We pipe the corpus here so it
          surfaces alongside the rest of the cooperative. The
          canonical URL stays with Paragraph, which is where the
          words were minted.
        </p>
      </div>

      <ol className="mt-12 space-y-6">
        {articles.map((article) => (
          <ArticleRow key={article.id} article={article} />
        ))}
      </ol>

      <div className="mt-16 rounded-2xl border border-brand-magenta/30 bg-brand-magenta/5 px-6 py-6">
        <h2 className="font-display text-xl font-semibold text-brand-magenta">
          Read everything on Paragraph
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          The full archive plus anything new lives at{" "}
          <a
            href={PARAGRAPH_BASE}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline decoration-brand-magenta/50 underline-offset-4 hover:decoration-brand-magenta"
          >
            paragraph.com/@future-modern
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Single article row — title, excerpt, publish date, tags. Clicking
 * anywhere in the row opens the canonical piece on Paragraph in a
 * new tab.
 */
function ArticleRow({ article }: { article: Article }) {
  const publishedDate = new Date(article.publishedAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long" },
  );

  return (
    <li>
      <a
        href={paragraphUrl(article)}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        <Card className="transition-colors hover:border-brand-magenta/50">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-faint">
              {publishedDate}
            </span>
            <span className="text-[11px] text-ink-faint">
              paragraph.com/@future-modern ↗
            </span>
          </div>
          <CardTitle className="mt-1 text-xl">{article.title}</CardTitle>
          <p className="mt-3 text-sm text-ink-muted">{article.excerpt}</p>
          {article.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-faint"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </a>
    </li>
  );
}
