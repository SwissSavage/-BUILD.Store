"use client";

/**
 * QuoteFlipReveal — the dramatic reveal moment on /quotes/[token].
 *
 * Choreography, per the design brief:
 *   1. Client lands on the quote surface.
 *   2. Face-down TradingCards (CardBack) are shown in a row, one
 *      per proposed cooperator. Client sees the tier-tinted fractal
 *      backs but doesn't yet know who's under them.
 *   3. Client clicks "Reveal your team".
 *   4. Cards flip in a staggered sequence (180ms per card) to reveal
 *      TradingCard3D fronts with each cooperator.
 *   5. Once revealed, the layout transitions into TalentHand in
 *      selectable mode so the client can evaluate + pick their lead
 *      (Skip/Choose, non-destructive per Tier 13's reversibility).
 *   6. Parent surface (`/quotes/[token]`) reveals the scope + pricing
 *      + approve action once at least one cooperator is marked as
 *      chosen.
 *
 * The flip animation itself is driven by CSS `.fm-card-flipper--revealed`
 * (set on state change). Reduced-motion clients skip the transition
 * and see the front side directly.
 *
 * Client component — needs mouse state for the reveal button and
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
  const [revealed, setRevealed] = useState(false);

  if (crew.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No cooperators proposed on this quote yet.
      </p>
    );
  }

  // Build TalentHand entries once revealed. Same shape as the /projects
  // page uses; adds per-member relevance narrative.
  const talentHandEntries: TalentHandEntry[] = crew.map((c) => ({
    user: c.user,
    tier: c.tier,
    relevance: c.relevance,
  }));

  return (
    <section>
      {/* Pre-reveal: face-down card grid + reveal button */}
      {!revealed && (
        <div>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {crew.map((member, idx) => (
              <div
                key={member.user.id}
                className="fm-card-flipper"
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
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="inline-flex items-center justify-center rounded-full bg-brand-magenta px-8 py-3 font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              Reveal your team →
            </button>
            <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">
              {crew.length}{" "}
              {crew.length === 1 ? "cooperator" : "cooperators"} proposed
            </p>
          </div>
        </div>
      )}

      {/* Post-reveal: cards flip in staggered sequence, then transition
          to TalentHand for selection. We keep the flipper structure
          for the initial reveal frames, then swap to TalentHand once
          the flip animation would have completed. Simpler UX: show
          both — the flipped grid animates in, and the TalentHand
          renders below with selection actions. */}
      {revealed && (
        <div>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {crew.map((member, idx) => (
              <div
                key={member.user.id}
                className="fm-card-flipper fm-card-flipper--revealed"
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
              </div>
            ))}
          </div>

          <div className="mt-12">
            <TalentHand
              entries={talentHandEntries}
              contextLabel="Pick your lead"
              deal={false}
              selectable
              onDecision={onDecision}
            />
          </div>
        </div>
      )}
    </section>
  );
}
