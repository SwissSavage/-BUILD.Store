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


interface OnChainBadgeProps {
  /** How many canonizations this member holds. 0 renders nothing. */
  count: number;
  /** Whether the badge should render as a link. Defaults to false; the
   *  caller decides based on viewer context. */
  href?: string;
  /** Visual size. Default `sm`. */
  size?: "sm" | "md";
  /** Optional className passthrough for layout tweaks. */
  className?: string;
}

/**
 * PRESENTATIONAL ONLY. Takes the count, does not fetch it.
 *
 * 2026-09-03, in two moves. This used to read MOCK_CANONIZATIONS, so
 * the badge was awarded by seed data on /u/[handle], the team page,
 * the cohort pages and the talent hand. A badge claiming a member
 * holds an on-chain canonization is a factual claim about the chain,
 * and it was being made from a fixture.
 *
 * The first fix made it async and had it query directly. That broke
 * the production build: TalentHand is a "use client" component, so
 * importing this pulled `pg` into the client bundle and webpack could
 * not resolve fs, dns, net or tls. `tsc` cannot see that; only
 * `next build` can, which is why it reached CI.
 *
 * So the component stays dumb and the caller supplies `count`. Server
 * components fetch it; client components receive it as data from
 * whatever server component rendered them. A presentational badge has
 * no business opening a database connection anyway.
 */
export function OnChainBadge({
  count,
  href,
  size = "sm",
  className = "",
}: OnChainBadgeProps) {
  if (count <= 0) return null;

  const canonCount = count;

  const sizeClass =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2 py-0.5 text-[10px]";

  const content = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-brand-blue/40 bg-brand-blue/5 font-medium uppercase tracking-wider text-brand-blue ${sizeClass} ${className}`}
      aria-label={
        canonCount === 1
          ? "On-chain, one canonization on record"
          : `On-chain, ${canonCount} canonizations on record`
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
