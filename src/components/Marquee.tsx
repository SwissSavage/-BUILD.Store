/**
 * The header banner.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT CHANGED (2026-09-03)
 *
 * Jamar: "the scroll across the top. I think it's too small... It
 * should be big enough to make one complete pass in a cycle with a
 * gap, not 3 tiny ones."
 *
 * It was four copies of the line at text-xs with px-8 between them.
 * The phrase is short, the header strip is wide, so three of them sat
 * on screen at once and the whole thing read as repeating filler
 * rather than a statement.
 *
 * A seamless CSS marquee needs the track to be exactly two identical
 * halves, because the animation runs translateX(0) to -50%: at the end
 * of the cycle the second half is sitting exactly where the first half
 * started, so the loop is invisible. That is why there are two spans
 * and not one, and why adding a third would break the seam.
 *
 * Each half is min-w-[50vw]. The phrase takes what it needs and the
 * rest of that 50vw is the gap, so ONE line crosses per cycle no
 * matter how wide the header is or how long the phrase gets. Sizing
 * the gap in vw rather than padding is what makes that hold at every
 * breakpoint instead of only the one it was eyeballed at.
 * ─────────────────────────────────────────────────────────────
 */
const LINE = "world-$BUILDing people+products.";

export function Marquee() {
  return (
    <div className="hidden flex-1 overflow-hidden md:block">
      <div className="marquee whitespace-nowrap text-sm tracking-wide text-ink-muted">
        {/* Exactly two. See the note above before adding a third. */}
        <span className="inline-block min-w-[50vw]">{LINE}</span>
        <span className="inline-block min-w-[50vw]" aria-hidden>
          {LINE}
        </span>
      </div>
    </div>
  );
}
