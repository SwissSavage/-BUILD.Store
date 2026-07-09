/**
 * TaglineRare — the FM Rare∞ tagline as inline SVG.
 *
 * Replaces the earlier `.fm-holographic-text` CSS treatment. The
 * change of medium is deliberate: CSS `background-clip: text` can
 * only clip ONE gradient per element, but the tagline needs two —
 * a gold gradient for the border (stroke) and a magenta-blue-green
 * gradient for the infinity fill. SVG lets each be its own
 * `linearGradient` referenced by `stroke="url(...)"` and
 * `fill="url(...)"` independently.
 *
 * Composition (per Jamar's screenshots):
 *   - "Rare"  : white fill + gold-gradient stroke rim
 *   - "∞"     : magenta → blue → green fill + gold-gradient stroke rim
 *
 * Both share the same gold gradient so the border reads as a
 * continuous rim across the wordmark. The infinity sits as a
 * superscript, matching the visual weight in the FM brand system
 * (roughly 0.55em of the base "Rare" size, raised).
 *
 * `useId` prefixes the gradient IDs so the component can render
 * multiple times on the same page without SVG id collisions.
 *
 * Discipline note: the tagline is FM's most-loaded piece of copy
 * and this treatment is reserved for it. Do not apply this
 * component's gradient vocabulary to other headlines.
 */
import { useId } from "react";

interface TaglineRareProps {
  /**
   * ViewBox-independent size. The SVG uses width:100% by default so
   * container width drives scale; pass a max-width via `className`
   * or wrap the component to constrain it.
   */
  className?: string;
  /**
   * Accessible label — the SVG has role="img" and the label is what
   * screen readers announce. Defaults to "Rare to the infinity".
   */
  ariaLabel?: string;
}

export function TaglineRare({
  className,
  ariaLabel = "Rare to the infinity",
}: TaglineRareProps) {
  const id = useId().replace(/:/g, "");
  const goldId = `fm-tagline-gold-${id}`;
  const spectrumId = `fm-tagline-spectrum-${id}`;

  return (
    <svg
      viewBox="0 0 160 62"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height: "auto" }}
    >
      <defs>
        {/* Gold gradient — same stops as the Champion tier backdrop's
            gold anchor, brightened at the mid-stop for legibility.
            Runs left-to-right across both "Rare" and "∞". */}
        <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B8971E" />
          <stop offset="50%" stopColor="#F4CF57" />
          <stop offset="100%" stopColor="#B8971E" />
        </linearGradient>

        {/* Color-spectrum gradient for the infinity fill — magenta,
            blue, green in the FM palette order that already shows up
            on the Venture Labor OS constellation edges. */}
        <linearGradient id={spectrumId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D828A0" />
          <stop offset="55%" stopColor="#5070F0" />
          <stop offset="100%" stopColor="#007048" />
        </linearGradient>
      </defs>

      {/* "Rare" — white fill, gold gradient stroke. paint-order:stroke
          draws stroke first so the white fill covers the inner half,
          leaving only the outer rim visible. Font falls back to system
          sans if Abel hasn't loaded yet (SVG text rendering doesn't
          wait for font-display: swap the same way HTML text does). */}
      <text
        x="0"
        y="52"
        fontFamily="var(--font-abel), system-ui, sans-serif"
        fontSize="60"
        fontWeight="700"
        letterSpacing="-1.5"
        fill="#FFFFFF"
        stroke={`url(#${goldId})`}
        strokeWidth="1.5"
        style={{ paintOrder: "stroke" }}
      >
        Rare
      </text>

      {/* "∞" superscript — spectrum fill, gold rim. Sized and
          positioned so the top of the character aligns with the top
          of "R" and the bottom lands at roughly the middle of R's
          counter (the enclosed negative space inside the bowl).
          fontSize=54 gives the exponent real presence without pushing
          it into full-height headline weight; y=35 places the baseline
          low enough that character extent hits both cap-line and
          counter-mid; x=100 sits tucked against the "e" without
          overlap. */}
      <text
        x="100"
        y="35"
        fontFamily="var(--font-abel), system-ui, sans-serif"
        fontSize="54"
        fontWeight="700"
        fill={`url(#${spectrumId})`}
        stroke={`url(#${goldId})`}
        strokeWidth="1"
        style={{ paintOrder: "stroke" }}
      >
        ∞
      </text>
    </svg>
  );
}
