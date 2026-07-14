"use client";

/**
 * QuoteFlipReveal — the dramatic reveal moment on /quotes/[token].
 *
 * Choreography, per the design brief:
 *   1. Client lands on the quote surface.
 *   2. Face-down TradingCards (CardBack) are shown, one per proposed
 *      cooperator. Client sees the tier-tinted fractal backs but
 *      doesn't yet know who's under them.
 *   3. Client can either:
 *        - Click any individual face-down card to flip that one card
 *          (curiosity-driven, per-cooperator reveal), or
 *        - Click "Reveal all" to flip every remaining card at once
 *          (dramatic bulk reveal, same effect as the original design).
 *   4. Cards flip via CSS transform to reveal TradingCard3D fronts.
 *   5. Once every card is flipped, the layout transitions into
 *      TalentHand in selectable mode so the client can evaluate + pick
 *      their lead (Skip/Choose, non-destructive per Tier 13's
 *      reversibility).
 *   6. Parent surface (`/quotes/[token]`) reveals the Approve action
 *      once at least one cooperator is marked as chosen.
 *
 * The flip animation itself is driven by CSS `.fm-card-flipper--revealed`
 * (set on state change per card). Reduced-motion clients skip the
 * transition and see the front side directly.
 *
 * Client component — needs mouse state for the flip interactions and
 * onDecision callback wiring for TalentHand.
 */

import { useState } from "react";
import { CardBack } from "@/components/CardBack";
import { TradingCard3D } from "@/components/TradingCard3D";
import {
  TalentHand,
  type TalentHandDecision,
  type TalentHandEntry,
} from "@/components/TalentHand";
import type { TradingCardTier } from "@/components/TradingCard";
import type { User } from "@/lib/types";

export interface QuoteFlipReveaCrewMember {
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
  relevance: string;
}

interface QuoteFlipRevealProps {
  crew: QuoteFlipReveaCrewMember[];
  /**
   * Called every time the client marks a card (choose / skip). Parent
   * uses this to reveal the Approve action once the client has picked
   * a lead.
   */
  onDecision?: (userId: string, decision: TalentHandDecision) => void;
}

export function QuoteFlipReveal({
  crew,
  onDecision,
}: QuoteFlipRevealProps) {
  // Per-card flip state. A card is flipped (front visible) once its
  // userId lives in this set. Client can flip cards individually by
  // clicking each face-down card, or flip everything remaining via
  // the "Reveal all" button.
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());

  if (crew.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No cooperators proposed on this quote yet.
      </p>
    );
  }

  const allFlipped = flippedIds.size === crew.length;
  const remaining = crew.length - flippedIds.size;

  function flipOne(userId: string) {
    setFlippedIds((prev) => {
      if (prev.has(userId)) return prev;
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  }

  function flipAll() {
    setFlippedIds(new Set(crew.map((c) => c.user.id)));
  }

  // Build TalentHand entries once every card is flipped. Same shape as
  // the /projects page uses; adds per-member relevance narrative.
  const talentHandEntries: TalentHandEntry[] = crew.map((c) => ({
    user: c.user,
    tier: c.tier,
    relevance: c.relevance,
  }));

  return (
    <section>
      {/* Reveal grid: face-down cards, flip individually or bulk. */}
      {!allFlipped && (
        <div>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {crew.map((member, idx) => {
              const isFlipped = flippedIds.has(member.user.id);
              return (
                <button
                  key={member.user.id}
                  type="button"
                  onClick={() => flipOne(member.user.id)}
                  disabled={isFlipped}
                  aria-label={
                    isFlipped
                      ? `${member.user.firstName} ${member.user.lastName} card revealed`
                      : `Reveal card ${idx + 1} of ${crew.length}`
                  }
                  className={
                    "fm-card-flipper block w-full cursor-pointer border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-default" +
                    (isFlipped ? " fm-card-flipper--revealed" : "")
                  }
                  style={
                    {
                      "--flip-index": idx,
                    } as React.CSSProperties
                  }
                >
                  <div className="fm-card-flipper-inner aspect-[3/4]">
                    <div className="fm-card-face fm-card-face--back">
                      <CardBack tier={member.tier} />
                    </div>
                    <div className="fm-card-face fm-card-face--front">
                      <TradingCard3D
                        user={member.user}
                        tier={member.tier}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-10 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={flipAll}
              className="inline-flex items-center justify-center rounded-full bg-brand-magenta px-8 py-3 font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              {flippedIds.size === 0
                ? "Reveal all →"
                : `Reveal remaining (${remaining}) →`}
            </button>
            <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">
              Or click any card to flip it one at a time
            </p>
          </div>
        </div>
      )}

      {/* Once every card is flipped, TalentHand becomes the sole
          surface for evaluation + selection. Its Skip/Choose buttons
          are the primary interactive affordance from here forward.
          Deal-in animation replays on mount so the transition reads as
          a fresh reveal moment. */}
      {allFlipped && (
        <div>
          <TalentHand
            entries={talentHandEntries}
            contextLabel="Pick your lead"
            deal
            selectable
            onDecision={onDecision}
          />
        </div>
      )}
    </section>
  );
}
