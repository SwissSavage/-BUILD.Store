"use client";

/**
 * TalentHand — builders presented as a dealt hand of cards.
 *
 * Every time the cooperative surfaces people to clients (RFP quote
 * responses, team selection options, "who was on this" retro views on
 * projects/jobs/contracts feeds), it should read as a curated hand,
 * not a résumé stack. The dealing animation, the card pager,
 * and the TradingCard3D per member all reinforce the same brand
 * language: not marketplace, boutique cooperative.
 *
 * Design posture:
 *   - Explicit previous/next controls page through one card at a time.
 *     Keyboard, touch, and assistive technology do not have to discover
 *     a horizontal scrollbar.
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { TradingCard3D } from "@/components/TradingCard3D";
import { TierBadge } from "@/components/TierBadge";
import { OnChainBadge } from "@/components/OnChainBadge";
import { publicName, type User } from "@/lib/types";
import {
  memberLabel,
  type MemberLabelContext,
} from "@/lib/member-label";
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
   * Canonizations this member holds. Passed in rather than fetched:
   * this is a "use client" component, so a database read here drags
   * `pg` into the client bundle and the build fails on unresolvable
   * node builtins. Defaults to 0, which renders no badge.
   */
  canonCount?: number;
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
   * The engagement this hand is being dealt for. When given, each
   * card's label leads with the skills that match it — and shows all
   * of them, since one contractor often covers several pieces of the
   * same brief.
   */
  engagement?: MemberLabelContext;
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
  engagement,
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
  const [dealState, setDealState] = useState<
    "pending" | "animating" | "complete"
  >(deal ? "pending" : "complete");
  useEffect(() => {
    if (!deal) {
      setDealState("complete");
      return;
    }
    // Micro-timeout so the class hits after paint, not during.
    setDealState("pending");
    const start = window.setTimeout(() => setDealState("animating"), 20);
    const finish = window.setTimeout(() => setDealState("complete"), 900);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(finish);
    };
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
  const [activeIndex, setActiveIndex] = useState(0);

  // A refreshed roster can be shorter than the previous hand. Keep the
  // pager on an actual person instead of leaving it beyond the last card.
  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, entries.length - 1)));
  }, [entries.length]);

  function setDecision(userId: string, decision: TalentHandDecision) {
    setDecisions((prev) => ({ ...prev, [userId]: decision }));
    onDecision?.(userId, decision);
  }

  if (entries.length === 0) return null;

  return (
    <section className="relative">
      {contextLabel && (
        <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-brand-magentaText">
          {contextLabel}
        </p>
      )}

      {/* One card at a time: the rest of the team is reachable by clear
          controls, not by a hidden horizontal scrollbar. */}
      <ol
        className="fm-hand-track mx-auto w-full max-w-[260px] pb-4 pt-2"
        aria-label={contextLabel ?? "Builders presented as a hand of cards"}
      >
        {entries.map((entry, idx) => {
          if (idx !== activeIndex) return null;
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
              "fm-hand-card" +
              (dealState === "animating"
                ? " fm-hand-card--dealt"
                : dealState === "complete"
                  ? " fm-hand-card--settled"
                  : "") +
              decisionClass
            }
            style={
              {
                "--deal-index": 0,
              } as React.CSSProperties
            }
          >
            <div className="w-full min-w-0">
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
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="min-w-0 break-words font-display text-base font-semibold">
                    {publicName(entry.user)}
                  </p>
                  <OnChainBadge count={entry.canonCount ?? 0} size="sm" />
                </div>
                {memberLabel(entry.user, engagement) && (
                  <p className="mt-0.5 break-words text-xs text-ink-muted">
                    {memberLabel(entry.user, engagement)}
                  </p>
                )}
                <div className="mt-2">
                  <TierBadge tier={entry.user.membershipTier} />
                </div>

                {entry.quoteLine && (
                  <div className="mt-3 rounded-xl border border-brand-magenta/30 bg-brand-magenta/5 px-3 py-2">
                    <p className="font-display text-lg font-semibold text-brand-magentaText">
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
                          className="inline-block rounded-full border border-[var(--surface-border)] px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted transition-colors hover:border-brand-magenta hover:text-brand-magentaText"
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

      {entries.length > 1 && (
        <div
          className="mx-auto flex max-w-[260px] items-center justify-between gap-3"
          aria-label="Team member navigation"
        >
          <button
            type="button"
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            disabled={activeIndex === 0}
            className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--surface-border)] text-ink-muted transition-colors hover:border-brand-magenta hover:text-brand-magentaText disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous team member"
          >
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.75} />
          </button>
          <div
            className="flex items-center gap-2"
            aria-label={`Team member ${activeIndex + 1} of ${entries.length}`}
          >
            {entries.map((member, index) => (
              <button
                key={member.user.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={
                  "size-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta " +
                  (index === activeIndex
                    ? "bg-brand-magenta"
                    : "bg-[var(--surface-border)] hover:bg-ink-faint")
                }
                aria-label={`Show ${publicName(member.user)}`}
                aria-current={index === activeIndex ? "true" : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setActiveIndex((index) => Math.min(entries.length - 1, index + 1))
            }
            disabled={activeIndex === entries.length - 1}
            className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--surface-border)] text-ink-muted transition-colors hover:border-brand-magenta hover:text-brand-magentaText disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next team member"
          >
            <ChevronRight aria-hidden="true" size={18} strokeWidth={1.75} />
          </button>
        </div>
      )}

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
