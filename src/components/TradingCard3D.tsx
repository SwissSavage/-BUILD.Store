"use client";

/**
 * TradingCard3D — Marvel Snap-style parallax player card.
 *
 * Same visual vocabulary as the flat TradingCard, rebuilt as a 3D
 * composition so layers can parallax when the card tilts. Each layer
 * sits at a different `translateZ` value inside a `perspective`
 * context; mouse position over the card drives `rotateX`/`rotateY`,
 * which parallaxes the layers naturally because they're at different
 * distances from the viewer.
 *
 * Layer stack, deepest → frontmost:
 *   1. Backdrop — tier-specific gradient. Sits deep. Moves least.
 *   2. FM watermark — mid-plane. Anchors the composition.
 *   3. Portrait — bg-removed character or Avatar fallback. Frontmost.
 *      Breaks the card plane when tilted (the Marvel Snap magic).
 *   4. Mouse-following holo sheen — surface layer, radial gradient
 *      positioned at the cursor via CSS custom properties.
 *
 * Fallbacks:
 *   - `prefers-reduced-motion: reduce` — CSS cuts the transition so
 *     the card doesn't animate. Interactive tilt still available but
 *     without the smooth return.
 *   - `@media (hover: none)` — touch devices don't get the mouse
 *     effect. Card sits at rest with no interaction.
 *
 * The flat `TradingCard` remains the base primitive; use this variant
 * on high-impact single-card surfaces (profile hero, marquee slots)
 * where the extra visual weight earns its keep. Roster grids should
 * stay flat to avoid animation overload.
 */

import { useRef, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";
import type { User } from "@/lib/types";
import type { TradingCardTier } from "@/components/TradingCard";

const MAX_TILT_DEG = 12;

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

interface TradingCard3DProps {
  user: Pick<
    User,
    | "id"
    | "firstName"
    | "lastName"
    | "handle"
    | "profileImageUrl"
    | "avatarPortraitUrl"
  >;
  tier?: TradingCardTier;
  children?: React.ReactNode;
  className?: string;
  aspectRatio?: "3/4" | "4/5" | "square";
}

export function TradingCard3D({
  user,
  tier = "standard",
  children,
  className,
  aspectRatio = "3/4",
}: TradingCard3DProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "4/5"
        ? "aspect-[4/5]"
        : "aspect-[3/4]";

  /**
   * Mouse tracking. Compute normalized [-1, 1] offsets from the card
   * center, translate to rotation degrees, and update the transform
   * inline. Sheen coordinates are pushed as CSS custom properties so
   * the radial gradient tracks the cursor without React re-renders on
   * every mousemove — much smoother than useState.
   */
  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const wrapper = wrapperRef.current;
    const face = faceRef.current;
    if (!wrapper || !face) return;

    const rect = wrapper.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 → 1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

    const rotateX = (-ny * MAX_TILT_DEG).toFixed(2);
    const rotateY = (nx * MAX_TILT_DEG).toFixed(2);

    face.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

    // Sheen tracks the cursor via CSS custom properties.
    const sheenX = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1);
    const sheenY = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1);
    wrapper.style.setProperty("--sheen-x", `${sheenX}%`);
    wrapper.style.setProperty("--sheen-y", `${sheenY}%`);
  }

  /**
   * Reset transform on mouse leave — smooth ease back to flat via the
   * CSS transition when the mouse isn't actively moving.
   */
  function handleMouseLeave() {
    const face = faceRef.current;
    const wrapper = wrapperRef.current;
    if (!face || !wrapper) return;
    face.style.transform = "rotateX(0deg) rotateY(0deg)";
    wrapper.style.setProperty("--sheen-x", "50%");
    wrapper.style.setProperty("--sheen-y", "50%");
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("fm-card-3d-wrapper", aspectClass, className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        // Sheen defaults so the card doesn't flash on first render.
        "--sheen-x": "50%",
        "--sheen-y": "50%",
      } as React.CSSProperties}
    >
      <div
        ref={faceRef}
        className={cn(
          "fm-card-3d-face relative isolate overflow-hidden rounded-2xl border bg-[var(--surface-elevated)]",
          "h-full w-full",
        )}
        style={{ borderColor: TIER_BORDER[tier] }}
      >
        {/* Layer 1 — Backdrop. Deepest. Moves least under parallax. */}
        <div
          className={cn("fm-card-3d-layer-back absolute inset-0", TIER_BG_CLASS[tier])}
          aria-hidden
        />

        {/* Layer 2 — FM watermark. Mid-plane anchor. */}
        <div
          className="fm-card-3d-layer-mid pointer-events-none absolute right-4 top-4 select-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/40"
          aria-hidden
        >
          Future Modern
        </div>

        {/* Layer 3 — Portrait. Frontmost. Breaks the plane. */}
        <div className="fm-card-3d-layer-front absolute inset-x-0 bottom-0 flex justify-center">
          {user.avatarPortraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarPortraitUrl}
              alt=""
              aria-hidden="true"
              className="h-full max-h-[92%] w-auto object-contain object-bottom drop-shadow-[0_20px_25px_rgba(0,0,0,0.35)]"
            />
          ) : (
            <div className="mb-6 flex h-32 w-32 items-center justify-center">
              <Avatar user={user} size="xl" />
            </div>
          )}
        </div>

        {/* Layer 4 — Mouse-following holo sheen. Surface plane. */}
        <div className="fm-card-3d-sheen pointer-events-none absolute inset-0" aria-hidden />

        {/* Champion tier keeps the animated diagonal sweep too — it's a
            legendary marker, not just a color. Fires alongside the
            mouse-tracked sheen. */}
        {tier === "champion" && (
          <div
            className="pointer-events-none absolute inset-0 fm-holo-sheen mix-blend-screen"
            aria-hidden
          />
        )}

        {/* Composed content on top of the card face. */}
        {children && (
          <div className="fm-card-3d-content relative z-10 flex h-full flex-col p-5">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
