"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { FaqItem } from "@/components/Faq";

/** One answer stays open at a time so the FAQ remains a short reading path. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState(items.length > 0 ? 0 : -1);

  return (
    <div className="mt-10 space-y-3">
      {items.map((item, index) => {
        const isOpen = index === openIndex;
        const answerId = `faq-answer-${index}`;

        return (
          <div
            key={item.question}
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 transition-colors hover:border-brand-magenta/40"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={answerId}
              onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
              className="flex w-full cursor-pointer items-start justify-between gap-4 text-left font-display text-lg font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-magenta"
            >
              <span>{item.question}</span>
              <Plus
                aria-hidden="true"
                size={20}
                strokeWidth={1.75}
                className={`mt-0.5 shrink-0 text-brand-magentaText transition-transform duration-200 ${
                  isOpen ? "rotate-45" : ""
                }`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
                isOpen
                  ? "mt-3 grid-rows-[1fr] opacity-100"
                  : "mt-0 grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
              <div
                id={answerId}
                role="region"
                aria-label={item.question}
                aria-hidden={!isOpen}
                className="space-y-3 text-sm text-ink-muted"
              >
                {item.answer.split("\n\n").map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
