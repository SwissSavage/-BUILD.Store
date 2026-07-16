/**
 * CardBack — the face-down side of a TradingCard.
 *
 * Used on the /quotes/[token] flip-reveal (client opens their quote,
 * sees N face-down cards, they flip to reveal the proposed crew).
 * Same aspect ratio + border treatment as TradingCard so it slots
 * into the flip animation cleanly.
 *
 * Composition, following the Yu-Gi-Oh / Pokémon card-back vocabulary:
 *   - Tier-tinted hexagonal fractal pattern as the backdrop —
 *     self-similar geometry, echoes the cooperative-as-honeycomb
 *     motif, per-tier color inheritance via CSS `color:` on the SVG.
 *   - FM turtle logo centered — the brand mark under a scarce object.
 *   - "Future Modern" wordmark upper-right — the publisher-mark
 *     position on YGO cards ("KAZUKI TAKAHASHI").
 *   - Rare∞ holographic in bottom-left — asymmetric brand anchor,
 *     matches the tagline treatment from Tier 11.
 *   - Champion tier layers the animated holographic conic-gradient
 *     behind the fractal (same rhythm as the front-facing Champion
 *     card).
 *
 * Server component — no interactivity here. The flip animation lives
 * on the parent surface that composes CardBack + TradingCard(3D) as
 * two sides of the same 3D-transformed container.
 */
import { cn } from "@/lib/cn";
import type { TradingCardTier } from "@/components/TradingCard";
import { TaglineRare } from "@/components/TaglineRare";

/**
 * Per-tier fractal stroke color — the SVG pattern paths use
 * `currentColor` so we set it via CSS `color:` on the SVG wrapper.
 * Champion is handled separately — the fractal uses gold and the
 * animated conic-gradient sits behind.
 */
const TIER_FRACTAL_COLOR: Record<TradingCardTier, string> = {
  standard: "rgba(255, 255, 255, 0.32)",
  probation: "rgba(180, 180, 180, 0.38)",
  good_standing: "rgba(60, 190, 130, 0.42)",
  promotion_eligible: "rgba(120, 150, 250, 0.46)",
  future_modernist: "rgba(230, 100, 190, 0.52)",
  champion: "rgba(212, 175, 55, 0.68)", // gold
};

const TIER_BG_CLASS: Record<TradingCardTier, string> = {
  standard: "fm-card-bg-standard",
  probation: "fm-card-bg-probation",
  good_standing: "fm-card-bg-good-standing",
  promotion_eligible: "fm-card-bg-promotion",
  future_modernist: "fm-card-bg-future-modernist",
  champion: "fm-card-bg-champion",
};

const TIER_BORDER: Record<TradingCardTier, string> = {
  standard: "var(--surface-border)",
  probation: "rgba(102, 102, 102, 0.5)",
  good_standing: "rgba(0, 112, 72, 0.6)",
  promotion_eligible: "rgba(80, 112, 240, 0.6)",
  future_modernist: "rgba(216, 40, 160, 0.65)",
  champion: "rgba(212, 175, 55, 0.75)",
};

interface CardBackProps {
  tier?: TradingCardTier;
  className?: string;
  aspectRatio?: "3/4" | "4/5" | "square";
}

export function CardBack({
  tier = "standard",
  className,
  aspectRatio = "3/4",
}: CardBackProps) {
  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "4/5"
        ? "aspect-[4/5]"
        : "aspect-[3/4]";

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border bg-[var(--surface-elevated)]",
        aspectClass,
        className,
      )}
      style={{ borderColor: TIER_BORDER[tier] }}
      aria-label="Cooperator card, face down"
    >
      {/* Tier-tinted backdrop. Same class family as TradingCard so
          the Champion tier picks up the animated holographic gradient
          automatically — no separate handling. */}
      <div
        className={cn("absolute inset-0", TIER_BG_CLASS[tier])}
        aria-hidden
      />

      {/* Fractal pattern overlay. Hexagonal tessellation with nested
          inner hexagons + center dot — self-similar geometry at three
          scales inside a single 18-unit tile, tiled across the card.
          `currentColor` inheritance lets us tint per tier via CSS. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{ color: TIER_FRACTAL_COLOR[tier] }}
        aria-hidden
      >
        <defs>
          <pattern
            id={`fm-fractal-hex-${tier}`}
            x="0"
            y="0"
            width="18"
            height="15.6"
            patternUnits="userSpaceOnUse"
          >
            {/* Outer hexagon */}
            <polygon
              points="9,0 18,4.6 18,11.5 9,15.6 0,11.5 0,4.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.4"
              opacity="0.55"
            />
            {/* Inner hexagon at half scale */}
            <polygon
              points="9,3 15.5,7 15.5,12 9,13 2.5,12 2.5,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.3"
              opacity="0.75"
            />
            {/* Center dot at quarter scale */}
            <circle
              cx="9"
              cy="8"
              r="0.55"
              fill="currentColor"
              opacity="0.9"
            />
          </pattern>
        </defs>
        <rect
          width="100"
          height="100"
          fill={`url(#fm-fractal-hex-${tier})`}
        />
      </svg>

      {/* FM turtle logo — centered anchor. Slight opacity so the
          fractal pattern reads through faintly on the edges. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/turtle.png"
          alt=""
          aria-hidden="true"
          className={cn(
            "h-[42%] w-auto object-contain",
            tier === "champion"
              ? "opacity-95 drop-shadow-[0_0_20px_rgba(212,175,55,0.35)]"
              : "opacity-85 drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
          )}
        />
      </div>

      {/* Upper-right — "Future Modern" publisher mark. YGO/Pokémon
          position for the copyright/author line. */}
      <div
        className="pointer-events-none absolute right-3 top-3 select-none text-[8px] font-bold uppercase tracking-[0.22em] text-white/50"
        aria-hidden
      >
        Future Modern
      </div>

      {/* Bottom-left — Rare∞ SVG tagline mark. Same component used
          on /about at full size; here it's constrained to a small
          width so it reads as a brand stamp, not a headline. YGO/
          Pokémon set-code position. */}
      <div
        className="pointer-events-none absolute bottom-3 left-3 w-[70px] select-none"
        aria-hidden
      >
        <TaglineRare ariaLabel="" />
      </div>
    </div>
  );
}
