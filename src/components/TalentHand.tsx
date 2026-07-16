"use client";

/**
 * TalentHand — builders presented as a dealt hand of cards.
 *
 * Every time the cooperative surfaces people to clients (RFP quote
 * responses, team selection options, "who was on this" retro views on
 * projects/jobs/contracts feeds), it should read as a curated hand,
 * not a résumé stack. The dealing animation, the horizontal scroll,
 * and the TradingCard3D per member all reinforce the same brand
 * language: not marketplace, boutique cooperative.
 *
 * Design posture:
 *   - Horizontal scroll with mandatory scroll-snap on each card.
 *     Keyboard + trackpad + touch all work natively.
 *   - Cards deal in on mount with staggered timing — first card lands
 *     at 100ms, each subsequent card +120ms. Slight rotation wobble
 *     as they land, matching how a physical dealt card settles.
 *   - Each card is a TradingCard3D so the Marvel Snap parallax rides
 *     on top of the deal-in.
 *   - Optional per-card `relevance` line — "why this person for this
 *     project" — sits under the card. Curated works link out.
 *   - Client-component only for the deal animation state; content
 *     otherwise renders server-side friendly.
 *
 * Uses:
 *   - Client quote responses (`/quotes/[token]`) — team options.
 *   - Project detail (`/projects/[id]`) — who's on this.
 *   - Job posts + contract feeds — retroactive crew view.
 *   - Any surface where "here are the people" wants to feel dealt.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { TradingCard3D } from "@/components/TradingCard3D";
import { TierBadge } from "@/components/TierBadge";
import { OnChainBadge } from "@/components/OnChainBadge";
import { publicName, type User } from "@/lib/types";
import type { TradingCardTier } from "@/components/TradingCard";

/**
 * Per-card decision states in `selectable` mode.
 *   - null       : untouched, awaiting evaluation
 *   - "choose"   : client picks this crew member (green glow)
 *   - "skip"     : client passes (card fades back into the deck)
 */
export type TalentHandDecision = "choose" | "skip" | null;

export interface TalentHandEntry {
  user: Pick<
    User,
    | "id"
    | "firstName"
    | "lastName"
    | "handle"
    | "profileImageUrl"
    | "avatarPortraitUrl"
    | "discipline"
    | "membershipTier"
  >;
  tier: TradingCardTier;
  /**
   * Per-card context — why this person for this hand. One line,
   * plain English, no jargon. Optional; when absent the card renders
   * without the sub-line.
   */
  relevance?: string;
  /**
   * Optional per-card quote line — Jamar's Google Doc canonization
   * (Service Provider | Quote | Timeline per row). When present, the
   * card renders a compact pricing + timeline block right under the
   * portrait so the client evaluates each Builder priced-in. Passed
   * as denormalized strings so TalentHand stays free of quote-domain
   * imports.
   */
  quoteLine?: {
    /** e.g. "$18,000 to $24,000" or "$150/hr". */
    pricingHeadline: string;
    /** e.g. "range" or "hourly, billed as delivered". */
    pricingUnit: string;
    /** e.g. "6 weeks" or "part-time across the engagement." */
    timeline: string;
  };
  /**
   * Curated portfolio thumbnails / links. Rendered as small chips
   * under the card. Each item opens the source in a new tab or
   * routes to an in-app portfolio surface.
   */
  curatedWorks?: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  /**
   * Optional href for the whole card — defaults to `/u/[handle]`
   * when the caller doesn't specify a target.
   */
  href?: string;
}

interface TalentHandProps {
  entries: TalentHandEntry[];
  /**
   * Eyebrow label above the hand — context for the reader. e.g.
   * "Crew · URL Media brand film" or "Team options for your project".
   */
  contextLabel?: string;
  /**
   * When true (default), cards animate in with the deal effect on
   * mount. Set false for admin-side previews where the effect
   * distracts.
   */
  deal?: boolean;
  /**
   * Aspect ratio passed through to each card. Default 3/4 sports-
   * card shape.
   */
  aspectRatio?: "3/4" | "4/5" | "square";
  /**
   * When true, each card gets Tinder-style evaluation actions
   * (Skip / Choose) so the reader triages the hand instead of just
   * browsing. Skipped cards fade back into the deck; chosen cards
   * light up green. Fires `onDecision` per interaction so the parent
   * can persist state or reveal a Submit button when all cards are
   * decided.
   */
  selectable?: boolean;
  /**
   * Called every time the reader marks a card. `decision` reflects
   * the new state (choose / skip / null-to-reset).
   */
  onDecision?: (userId: string, decision: TalentHandDecision) => void;
}

export function TalentHand({
  entries,
  contextLabel,
  deal = true,
  aspectRatio = "3/4",
  selectable = false,
  onDecision,
}: TalentHandProps) {
  /**
   * We render the deal-in class only after mount so SSR + first
   * paint don't animate stale content. Skip the animation flag
   * entirely when the caller opts out.
   */
  const [dealt, setDealt] = useState(!deal);
  useEffect(() => {
    if (!deal) return;
    // Micro-timeout so the class hits after paint, not during.
    const t = window.setTimeout(() => setDealt(true), 20);
    return () => window.clearTimeout(t);
  }, [deal]);

  /**
   * Per-card selection state — Tinder-style triage. Only used when
   * `selectable` is true; otherwise the map stays empty. Parent gets
   * notified via `onDecision` so it can persist state or reveal a
   * Submit button once every card has been marked.
   */
  const [decisions, setDecisions] = useState<
    Record<string, TalentHandDecision>
  >({});

  function setDecision(userId: string, decision: TalentHandDecision) {
    setDecisions((prev) => ({ ...prev, [userId]: decision }));
    onDecision?.(userId, decision);
  }

  if (entries.length === 0) return null;

  return (
    <section className="relative">
      {contextLabel && (
        <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-brand-magenta">
          {contextLabel}
        </p>
      )}

      {/* Horizontal-scroll hand. Scroll-snap ensures each card lands
          centered when the user swipes / arrow-keys through. */}
      <ol
        className="fm-hand-track flex snap-x snap-mandatory gap-6 overflow-x-auto pb-6 pt-2"
        aria-label={contextLabel ?? "Builders presented as a hand of cards"}
      >
        {entries.map((entry, idx) => {
          const decision = decisions[entry.user.id] ?? null;
          const decisionClass =
            decision === "choose"
              ? " fm-hand-card--chose"
              : decision === "skip"
                ? " fm-hand-card--skipped"
                : "";
          return (
          <li
            key={entry.user.id}
            className={
              "fm-hand-card snap-start" +
              (dealt ? " fm-hand-card--dealt" : "") +
              decisionClass
            }
            style={
              {
                "--deal-index": idx,
              } as React.CSSProperties
            }
          >
            <div className="w-[240px] shrink-0">
              <Link
                href={entry.href ?? `/u/${entry.user.handle}`}
                className="block"
              >
                <TradingCard3D
                  user={entry.user}
                  tier={entry.tier}
                  aspectRatio={aspectRatio}
                />
              </Link>

              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <p className="truncate font-display text-base font-semibold">
                    {publicName(entry.user)}
                  </p>
                  <OnChainBadge userId={entry.user.id} size="sm" />
                </div>
                {entry.user.discipline && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {entry.user.discipline}
                  </p>
                )}
                <div className="mt-2">
                  <TierBadge tier={entry.user.membershipTier} />
                </div>

                {entry.quoteLine && (
                  <div className="mt-3 rounded-xl border border-brand-magenta/30 bg-brand-magenta/5 px-3 py-2">
                    <p className="font-display text-lg font-semibold text-brand-magenta">
                      {entry.quoteLine.pricingHeadline}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-muted">
                      {entry.quoteLine.pricingUnit} · {entry.quoteLine.timeline}
                    </p>
                  </div>
                )}

                {entry.relevance && (
                  <p className="mt-3 border-l-2 border-brand-magenta/60 pl-3 text-[13px] italic text-ink-muted">
                    {entry.relevance}
                  </p>
                )}

                {entry.curatedWorks && entry.curatedWorks.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {entry.curatedWorks.map((work) => (
                      <li key={work.id}>
                        <Link
                          href={work.href}
                          className="inline-block rounded-full border border-[var(--surface-border)] px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted transition-colors hover:border-brand-magenta hover:text-brand-magenta"
                        >
                          {work.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Selection actions — visible only in `selectable`
                    mode. Clicking a state a second time toggles it
                    back to null so a client can revise a call. */}
                {selectable && (
                  <div className="mt-4 flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setDecision(
                          entry.user.id,
                          decision === "skip" ? null : "skip",
                        )
                      }
                      className={
                        "rounded-full border px-3 py-1 transition-colors " +
                        (decision === "skip"
                          ? "border-ink-faint text-ink-faint"
                          : "border-[var(--surface-border)] text-ink-muted hover:border-ink-faint hover:text-ink")
                      }
                      aria-pressed={decision === "skip"}
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDecision(
                          entry.user.id,
                          decision === "choose" ? null : "choose",
                        )
                      }
                      className={
                        "rounded-full border px-3 py-1 transition-colors " +
                        (decision === "choose"
                          ? "border-brand-green bg-brand-green/10 text-brand-green"
                          : "border-brand-green/40 text-brand-green hover:bg-brand-green/10")
                      }
                      aria-pressed={decision === "choose"}
                    >
                      Choose
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
          );
        })}
      </ol>

      {/* Reversibility affordance. Selectable mode is non-destructive —
          Skip and Choose both toggle back to null on a second click, and
          nothing locks in until the parent surface's confirm step fires.
          This copy signals that so a client doesn't feel Tinder-committed
          on a mis-tap or after a change-of-mind conversation. */}
      {selectable && (
        <p className="mt-1 text-[11px] text-ink-faint">
          Not final. Click again to un-mark, or swap after we talk it through.
        </p>
      )}
    </section>
  );
}
