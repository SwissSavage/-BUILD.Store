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
import type { ReactNode } from "react";
import { CardEyebrow } from "@/components/Card";
import { FaqAccordion } from "@/components/FaqAccordion";

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
  /** Optional page-specific path for people whose question is not answered. */
  aside?: ReactNode;
}

export function Faq({
  eyebrow = "FAQ",
  heading = "Common questions",
  items,
  aside,
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
      <div
        className={`mx-auto px-6 py-20 ${
          aside
            ? "grid max-w-app gap-10 lg:grid-cols-2 lg:gap-12"
            : "max-w-3xl"
        }`}
      >
        <div>
          <CardEyebrow>{eyebrow}</CardEyebrow>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            {heading}
          </h2>
          <FaqAccordion items={items} />
        </div>
        {aside && <aside className="lg:pt-1">{aside}</aside>}
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
