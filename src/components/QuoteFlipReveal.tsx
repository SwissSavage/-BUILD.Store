"use client";

/**
 * Client quote reveal: cards flip in their original grid, then remain there
 * while the client selects one by clicking its revealed face. Keeping this
 * surface mounted avoids the old deal-in replacement and its layout shift.
 */

import { useState } from "react";
import { CardBack } from "@/components/CardBack";
import { TradingCard3D } from "@/components/TradingCard3D";
import type { TalentHandDecision } from "@/components/TalentHand";
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
  pitch?: string;
  quoteLine: {
    pricingHeadline: string;
    pricingUnit: string;
    timeline: string;
  };
}

interface QuoteFlipRevealProps {
  crew: QuoteFlipReveaCrewMember[];
  onDecision?: (userId: string, decision: TalentHandDecision) => void;
}

function membershipLabel(member: QuoteFlipReveaCrewMember) {
  const membership = member.user.membershipTier === "member" ? "Member" : "Partner";
  return member.user.discipline ? `${membership} · ${member.user.discipline}` : membership;
}

const TIER_LABEL_CLASS: Record<TradingCardTier, string> = {
  standard: "text-white/70",
  member: "text-brand-magentaText",
  probation: "text-ink-muted",
  good_standing: "text-brand-green",
  promotion_eligible: "text-brand-blue",
  future_modernist: "text-brand-magentaText",
  champion: "text-[#D4AF37]",
};

export function QuoteFlipReveal({ crew, onDecision }: QuoteFlipRevealProps) {
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  if (crew.length === 0) {
    return <p className="text-sm text-ink-muted">No builders proposed on this quote yet.</p>;
  }

  const allFlipped = flippedIds.size === crew.length;
  const remaining = crew.length - flippedIds.size;
  const selected = crew.find((member) => member.user.id === selectedUserId) ?? null;

  function flipOne(userId: string) {
    setFlippedIds((previous) => new Set(previous).add(userId));
  }

  function selectBuilder(userId: string) {
    const deselecting = selectedUserId === userId;
    setSelectedUserId(deselecting ? null : userId);
    onDecision?.(userId, deselecting ? "skip" : "choose");
  }

  function handleCardClick(userId: string) {
    if (!flippedIds.has(userId)) {
      flipOne(userId);
      return;
    }
    if (allFlipped) selectBuilder(userId);
  }

  function flipAll() {
    setFlippedIds(new Set(crew.map((member) => member.user.id)));
  }

  return (
    <section>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {crew.map((member, index) => {
          const isFlipped = flippedIds.has(member.user.id);
          const isSelected = selectedUserId === member.user.id;
          const name = `${member.user.firstName} ${member.user.lastName}`.trim() || member.user.handle;
          return (
            <button
              key={member.user.id}
              type="button"
              onClick={() => handleCardClick(member.user.id)}
              aria-label={
                !isFlipped
                  ? `Reveal card ${index + 1} of ${crew.length}`
                  : isSelected
                    ? `${name} selected. Click to clear selection.`
                    : `Select ${name} and read their proposal.`
              }
              aria-pressed={isFlipped ? isSelected : undefined}
              className={
                "fm-card-flipper fm-quote-card-option block w-full cursor-pointer border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]" +
                (isFlipped ? " fm-card-flipper--revealed" : "") +
                (isSelected ? " fm-quote-card-option--selected" : "")
              }
              style={{ "--flip-index": index } as React.CSSProperties}
            >
              <div className="fm-card-flipper-inner aspect-[3/4]">
                <div className="fm-card-face fm-card-face--back">
                  <CardBack tier={member.tier} />
                </div>
                <div className="fm-card-face fm-card-face--front">
                  <TradingCard3D user={member.user} tier={member.tier}>
                    <div className="mt-auto flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-xl font-semibold text-white">{name}</p>
                        <p className={`mt-1 line-clamp-2 text-[10px] font-medium uppercase tracking-wider ${TIER_LABEL_CLASS[member.tier]}`}>
                          {membershipLabel(member)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-base font-semibold text-white">{member.quoteLine.pricingHeadline}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-wider text-white/65">{member.quoteLine.pricingUnit}</p>
                      </div>
                    </div>
                  </TradingCard3D>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!allFlipped && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button type="button" onClick={flipAll} className="fm-btn-primary inline-flex items-center justify-center rounded-full px-8 py-3 font-medium shadow-lg shadow-brand-magenta/20 transition-colors">
            {flippedIds.size === 0 ? "Reveal all →" : `Reveal remaining (${remaining}) →`}
          </button>
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">Or reveal each card one at a time</p>
        </div>
      )}

      {allFlipped && (
        <section className="mt-8 border-t border-[var(--surface-border)] pt-6" aria-live="polite">
          {selected ? (
            <>
              <p className="text-xs uppercase tracking-wider text-brand-magentaText">Why {selected.user.firstName} fits</p>
              <p className="mt-3 max-w-3xl whitespace-pre-line text-base leading-relaxed text-ink-muted">
                {selected.pitch || selected.relevance}
              </p>
              <p className="mt-4 text-sm text-ink-faint">{selected.quoteLine.timeline}</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Select a builder card to read their proposal and availability.</p>
          )}
        </section>
      )}
    </section>
  );
}
