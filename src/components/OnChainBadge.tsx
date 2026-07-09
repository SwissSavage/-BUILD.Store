/**
 * On-chain badge — renders when a Member holds at least one
 * canonization record.
 *
 * The cooperative's Web3-native posture rendered as a small, quiet
 * signal on public surfaces. Every year, every active Member (and any
 * Partner who held a recognition that year) mints an ERC-721
 * canonization card with an ERC-6551 token-bound account. That mint is
 * portable proof of standing — the Member owns their contribution
 * record on-chain, not on some platform's rating table.
 *
 * The badge sits near the tier + name treatment. Links to
 * `/profile/canon` for the viewer's own canon, or `/u/[handle]/canon`
 * as the peer view if we build that surface. For now the badge is
 * decorative on peer surfaces and linked on self-view.
 *
 * Design posture: not gold. Gold stays reserved for Champion's Court
 * canonization cards themselves. The badge itself is neutral so it
 * doesn't compete with the tier color the card already carries.
 */
import { MOCK_CANONIZATIONS } from "@/lib/mock-data/canonizations";

interface OnChainBadgeProps {
  userId: string;
  /** Whether the badge should render as a link. Defaults to false; the
   *  caller decides based on viewer context. */
  href?: string;
  /** Visual size. Default `sm`. */
  size?: "sm" | "md";
  /** Optional className passthrough for layout tweaks. */
  className?: string;
}

/**
 * Server-side check: does this user have at least one canonization on
 * file? Pure data lookup, no cookie access — safe for static pages.
 */
export function isCanonized(userId: string): boolean {
  return MOCK_CANONIZATIONS.some((c) => c.userId === userId);
}

export function OnChainBadge({
  userId,
  href,
  size = "sm",
  className = "",
}: OnChainBadgeProps) {
  if (!isCanonized(userId)) return null;

  const canonCount = MOCK_CANONIZATIONS.filter(
    (c) => c.userId === userId,
  ).length;

  const sizeClass =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2 py-0.5 text-[10px]";

  const content = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-brand-blue/40 bg-brand-blue/5 font-medium uppercase tracking-wider text-brand-blue ${sizeClass} ${className}`}
      aria-label={
        canonCount === 1
          ? "On-chain — one canonization on record"
          : `On-chain — ${canonCount} canonizations on record`
      }
      title={
        canonCount === 1
          ? "Holds one on-chain canonization."
          : `Holds ${canonCount} on-chain canonizations.`
      }
    >
      {/* Ring icon — represents the token-bound account as a wallet
          orbit around the ERC-721. Purely decorative. */}
      <span aria-hidden className="text-brand-blue">
        ◈
      </span>
      On-chain
      {canonCount > 1 && (
        <span
          aria-hidden
          className="ml-0.5 rounded-full bg-brand-blue/10 px-1 text-[9px] tabular-nums"
        >
          {canonCount}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <a href={href} className="inline-block transition-opacity hover:opacity-80">
        {content}
      </a>
    );
  }

  return content;
}
