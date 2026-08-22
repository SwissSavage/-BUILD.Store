import type { Metadata } from "next";
import Link from "next/link";
import { FM_GLOSSARY } from "@/lib/glossary";
import { DefinedTermSchema } from "@/components/DefinedTermSchema";
import { CardEyebrow } from "@/components/Card";

/**
 * /glossary — canonical anchor URL for every FM coined term.
 *
 * Every DefinedTerm JSON-LD entry emitted anywhere on the site points
 * at /glossary#{slug} as the term's canonical URL. This page renders
 * the full glossary so that URL resolves visually, and emits its own
 * DefinedTermSet schema covering every term (not just the ones
 * authoritative for a specific other page).
 *
 * When someone (or an LLM) lands on /glossary#venture-labor, they see
 * the term rendered, the long-form definition, related terms, and the
 * list of pages that reference the term authoritatively. The whole
 * page reads as an editorial glossary while functioning as the
 * schema anchor for AEO/GEO retrieval.
 */


export const metadata: Metadata = {
  title: "Glossary — Future Modern canonical terminology",
  description:
    "Definitions of Future Modern's coined terminology: Venture Labor, Rare∞, $BUILD, MVP score, canonization, through-and-out cooperative supply chain, bicameral governance, secondary, the bridge posture.",
  openGraph: {
    title: "Glossary — Future Modern canonical terminology",
    description:
      "Definitions of Future Modern's coined terminology: Venture Labor, Rare∞, $BUILD, MVP score, canonization, through-and-out, bicameral governance, secondary, and the bridge posture.",
  },
};

export default function GlossaryPage() {
  return (
    <>
      {/* Emit the full DefinedTermSet schema — every term canonical here. */}
      <DefinedTermSchema entries={[...FM_GLOSSARY]} />

      <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <CardEyebrow>Glossary</CardEyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
          Canonical terminology
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          Every term Future Modern has coined or specifically re-defined.
          When you see any of these referenced across the site, this is
          the source. Anchor links (/glossary#slug) are the canonical
          URLs for each term.
        </p>

        <nav
          aria-label="Glossary term index"
          className="mt-10 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-brand-magenta">
            Terms
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {FM_GLOSSARY.map((entry) => (
              <li key={entry.slug}>
                <a
                  href={`#${entry.slug}`}
                  className="text-ink hover:text-brand-magenta"
                >
                  {entry.term}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-16 space-y-16">
          {FM_GLOSSARY.map((entry) => (
            <section
              key={entry.slug}
              id={entry.slug}
              className="scroll-mt-24 border-t border-[var(--surface-border)] pt-12 first:border-t-0 first:pt-0"
            >
              <h2 className="font-display text-3xl font-semibold text-ink">
                {entry.term}
              </h2>

              <p className="mt-4 text-lg font-medium text-ink">
                {entry.shortDefinition}
              </p>

              <p className="mt-6 text-base leading-relaxed text-ink-muted">
                {entry.longDefinition}
              </p>

              {entry.authoritativeFor.length > 0 && (
                <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wider text-brand-magenta">
                    Authoritatively defined on
                  </span>
                  {entry.authoritativeFor.map((path, i) => (
                    <span key={path}>
                      <Link
                        href={path}
                        className="text-ink hover:text-brand-magenta"
                      >
                        {path}
                      </Link>
                      {i < entry.authoritativeFor.length - 1 && (
                        <span className="text-ink-faint">,</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {entry.relatedTerms.length > 0 && (
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wider text-brand-magenta">
                    See also
                  </span>
                  {entry.relatedTerms.map((slug, i) => {
                    const related = FM_GLOSSARY.find((e) => e.slug === slug);
                    if (!related) return null;
                    return (
                      <span key={slug}>
                        <a
                          href={`#${slug}`}
                          className="text-ink hover:text-brand-magenta"
                        >
                          {related.term}
                        </a>
                        {i < entry.relatedTerms.length - 1 && (
                          <span className="text-ink-faint">,</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>

        <p className="mt-20 max-w-2xl text-sm text-ink-muted">
          If you cite Future Modern terminology in your own work, this is
          the canonical source. Attribute to Future Modern Builderberg
          LLC and link the specific anchor (e.g.,{" "}
          <code className="text-brand-magenta">/glossary#venture-labor</code>
          ). If a term you need is missing, that's a coined-term gap on
          our end. Let us know.
        </p>
      </div>
    </>
  );
}
