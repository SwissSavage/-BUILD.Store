"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  TradingCard,
  type TradingCardTier,
} from "@/components/TradingCard";

type CohortBuilder = {
  id: string;
  href: string;
  name: string;
  label: string;
  joinedLabel: string;
  tier: TradingCardTier;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    handle: string;
    profileImageUrl: string | null;
    avatarPortraitUrl: string | null;
  };
};

const VISIBLE_ON_DESKTOP = 3;

/**
 * The homepage is a living joiner feed, but it should read like a small
 * hand-picked deck instead of an unbounded horizontal directory. The newest
 * builder leads; arrows reveal every other eligible builder in join order.
 */
export function CohortDeck({
  builders,
  leadLabel,
}: {
  builders: CohortBuilder[];
  leadLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleCount = Math.min(VISIBLE_ON_DESKTOP, builders.length);
  const activeBuilders = Array.from(
    { length: visibleCount },
    (_, offset) => builders[(activeIndex + offset) % builders.length],
  );
  const hasMultipleBuilders = builders.length > 1;
  const hasDesktopOverflow = builders.length > VISIBLE_ON_DESKTOP;

  const previous = () =>
    setActiveIndex((index) => (index - 1 + builders.length) % builders.length);
  const next = () => setActiveIndex((index) => (index + 1) % builders.length);

  return (
    <div className="mt-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {hasMultipleBuilders
            ? `${activeIndex + 1} of ${builders.length} builders leading the deck`
            : `${builders.length} ${builders.length === 1 ? "builder" : "builders"} joined`}
        </p>
        {hasMultipleBuilders && (
          <div
            className={`flex items-center gap-2 ${hasDesktopOverflow ? "" : "sm:hidden"}`}
          >
            <button
              type="button"
              onClick={previous}
              className="flex size-11 items-center justify-center rounded-lg border border-[var(--surface-border)] text-ink transition-colors hover:border-brand-magenta hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
              aria-label="Show earlier builders"
            >
              <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={next}
              className="flex size-11 items-center justify-center rounded-lg border border-[var(--surface-border)] text-ink transition-colors hover:border-brand-magenta hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
              aria-label="Show later builders"
            >
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-[1.15fr_repeat(2,minmax(0,1fr))] md:gap-6">
        {activeBuilders.map((builder, index) => (
          <li
            key={builder.id}
            className={index === 0 ? "sm:col-span-1" : "hidden sm:block"}
          >
            <TradingCard
              user={builder.user}
              href={builder.href}
              tier={builder.tier}
              aspectRatio="3/4"
              className="transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="mt-auto">
                <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                  {activeIndex === 0 && index === 0
                    ? leadLabel
                    : builder.joinedLabel}
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {builder.name}
                </h3>
                <p className="mt-1 text-sm text-white/75">{builder.label}</p>
              </div>
            </TradingCard>
          </li>
        ))}
      </ul>
      {hasMultipleBuilders && (
        <p className="mt-3 text-xs text-ink-faint sm:hidden">
          Use the arrows to meet every new builder.
        </p>
      )}
    </div>
  );
}
