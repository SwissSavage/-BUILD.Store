/**
 * FAQ surface — reusable across marketing pages.
 *
 * Renders as a section of expandable native <details>/<summary> Q&A
 * (no client JS required — works statically) plus an inline JSON-LD
 * FAQPage schema so Google can render expandable Q&A directly in the
 * search results page. That's real SERP real-estate for zero cost.
 *
 * Callers pass an ordered list of Q&A items. The component handles
 * the visual treatment, schema emission, and semantic markup. Use one
 * per page — search engines get confused when a URL emits multiple
 * FAQPage payloads.
 */
import { CardEyebrow } from "@/components/Card";

export interface FaqItem {
  /** The question, in FM voice. Short-form works best. */
  question: string;
  /**
   * The answer, in FM voice. Plain text. Paragraph breaks accepted
   * as `\n\n` and rendered as separate <p>s. HTML is not permitted —
   * Google's FAQPage schema wants text, and prose in FM voice reads
   * better without markup gymnastics.
   */
  answer: string;
}

interface FaqProps {
  /** Section eyebrow — defaults to "FAQ". Override for tone/context. */
  eyebrow?: string;
  /** Section heading. Falls back to a clean default. */
  heading?: string;
  /** Q&A items rendered in order. */
  items: FaqItem[];
}

export function Faq({
  eyebrow = "FAQ",
  heading = "Common questions",
  items,
}: FaqProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className="border-t border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <CardEyebrow>{eyebrow}</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
          {heading}
        </h2>

        <div className="mt-10 space-y-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 transition-colors hover:border-brand-magenta/40"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-lg font-semibold text-ink">
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-brand-magenta transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="mt-3 space-y-3 text-sm text-ink-muted">
                {item.answer.split("\n\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* FAQPage JSON-LD — Google renders these as expandable Q&A in
          the search results. One schema block per URL; the calling
          page owns page-level uniqueness by only rendering one <Faq />. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </section>
  );
}
