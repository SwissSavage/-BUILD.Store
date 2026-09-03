/**
 * /case-studies — public index of completed contracts (task #32).
 *
 * Every contract with `status="completed"` and `rfpApprovedAt` set
 * lands here as an indexable page. First-name-only credits on
 * contributors per FM's public-privacy policy; client identity
 * follows the FM depersonalization rule — cases show as "Future
 * Modern contract" until public delivery flips a project into
 * showcase territory (deferred to a Showcase editorial layer).
 *
 * URL choice: `/case-studies` because `/projects` is taken by the
 * member-facing tracker at (app)/projects/[id]. Route groups can't
 * resolve the same URL twice; distinct slug keeps them clean.
 *
 * SEO surface: each detail page emits CreativeWork JSON-LD via the
 * PersonJsonLd module. Sitemap enumerates every completed project so
 * search engines discover the full library.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { getAllProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { INDUSTRY_LABELS } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";

export const dynamic = "force-dynamic";

// NOTE: intentionally NOT `force-static`. Force-static evaluates
// cookies() as empty at build time, which propagates up into the
// (public) layout's Nav and renders it in the signed-out state even
// when the visitor has a valid session — the effect is that clicking
// "Case studies" appears to sign the user out. Leaving this route
// dynamic (default) keeps the Nav auth-aware; the page itself still
// caches well at the CDN via response headers.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

export const metadata: Metadata = {
  title: "Case studies — Future Modern",
  description:
    "Completed contracts delivered through the Future Modern cooperative. STEM, Creative Media, and Professional Services engagements.",
  alternates: { canonical: `${SITE_URL}/case-studies` },
};

export default async function CaseStudiesIndex() {
  const { projects: allProjects } = await safely(() => getAllProjects(), {
    projects: [],
    source: "postgres" as const,
  });
  const completed = allProjects.filter(
    (p) =>
      p.kind === "contract" &&
      p.status === "completed" &&
      p.rfpApprovedAt !== null,
  ).sort((a, b) =>
    (b.collectedAt ?? b.rfpApprovedAt ?? "").localeCompare(
      a.collectedAt ?? a.rfpApprovedAt ?? "",
    ),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Case studies</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Completed contracts
      </h1>
      <p className="mt-3 text-lg text-ink-muted">
        Work delivered through the cooperative. Client names stay
        depersonalized until public delivery; contributors are credited
        by first name only.
      </p>

      {completed.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          No completed case studies yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-4">
          {completed.map((p) => (
            <Card key={p.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  {INDUSTRY_LABELS[p.industry]}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {new Date(
                    p.collectedAt ?? p.rfpApprovedAt ?? p.createdAt,
                  ).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <Link
                href={`/case-studies/${p.id}`}
                className="mt-2 block font-display text-2xl font-semibold hover:text-brand-magentaText"
              >
                {p.title}
              </Link>
              <p className="mt-2 line-clamp-3 text-sm text-ink-muted">
                {p.description}
              </p>
              {p.skillsRequired.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.skillsRequired.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] text-ink-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
