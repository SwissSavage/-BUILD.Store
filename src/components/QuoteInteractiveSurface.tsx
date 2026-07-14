"use client";

/**
 * QuoteInteractiveSurface — the client-side shell for /quotes/[token]
 * pre-decision state. Owns the reveal → selection → approve/decline
 * flow end-to-end.
 *
 * Renders:
 *   1. QuoteFlipReveal (reveal moment + TalentHand selection)
 *   2. Scope block (static, but rendered here so the client component
 *      owns the full pre-decision surface as one boundary)
 *   3. Pricing block (same)
 *   4. Decision panel with Approve + Decline buttons + optional
 *      decline reason textarea
 *
 * State model:
 *   - selectedLeadUserId is the "chose" mark from QuoteFlipReveal.
 *     Only one lead can be chosen at a time — the most recent chose
 *     wins. Skipping the current lead clears the selection.
 *   - Approve is disabled until a lead is chosen.
 *   - Decline shows a reveal-on-click reason textarea that submits
 *     the decline action.
 *
 * Server actions (`approveCooperativeQuote` / `declineCooperativeQuote`)
 * are called directly. On success the page revalidates and re-renders
 * into the decided state (handled by the parent server component
 * branching on quote.status).
 *
 * Access model: no auth — token possession is the credential. Same
 * pattern as /invoices/[token] and /receipts/[token].
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  QuoteFlipReveal,
  type QuoteFlipReveaCrewMember,
} from "@/components/QuoteFlipReveal";
import { CardEyebrow } from "@/components/Card";
import type { TalentHandDecision } from "@/components/TalentHand";
import {
  approveCooperativeQuote,
  declineCooperativeQuote,
} from "@/lib/quote-actions";
import {
  pricingHeadline,
  pricingUnitLabel,
} from "@/lib/quote-pricing";
import type { CooperativeQuotePricing } from "@/lib/types";

interface QuoteInteractiveSurfaceProps {
  clientToken: string;
  scope: {
    summary: string;
    deliverables: string[];
    timeline: string;
  };
  pricing: CooperativeQuotePricing;
  crew: QuoteFlipReveaCrewMember[];
}

export function QuoteInteractiveSurface({
  clientToken,
  scope,
  pricing,
  crew,
}: QuoteInteractiveSurfaceProps) {
  const router = useRouter();
  const [selectedLeadUserId, setSelectedLeadUserId] = useState<string | null>(
    null,
  );
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDecision(userId: string, decision: TalentHandDecision) {
    if (decision === "choose") {
      setSelectedLeadUserId(userId);
      setError(null);
    } else if (decision === "skip") {
      // Skipping the currently-selected lead clears the selection.
      // Skipping any other card doesn't affect the selection.
      if (selectedLeadUserId === userId) {
        setSelectedLeadUserId(null);
      }
    }
  }

  function handleApprove() {
    if (!selectedLeadUserId || pending) return;
    setError(null);
    const formData = new FormData();
    formData.set("token", clientToken);
    formData.set("selectedLeadUserId", selectedLeadUserId);
    startTransition(async () => {
      try {
        await approveCooperativeQuote(formData);
        // router.refresh() forces the parent server component to
        // re-fetch and re-render into the approved state. Without
        // this the client stays mounted with pre-approval UI and
        // the client sees "nothing happen" on click.
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function handleDeclineSubmit() {
    if (pending) return;
    setError(null);
    const formData = new FormData();
    formData.set("token", clientToken);
    formData.set("reason", declineReason.trim());
    startTransition(async () => {
      try {
        await declineCooperativeQuote(formData);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const leadName = (() => {
    if (!selectedLeadUserId) return null;
    const found = crew.find((c) => c.user.id === selectedLeadUserId);
    if (!found) return null;
    return `${found.user.firstName} ${found.user.lastName}`.trim();
  })();

  return (
    <>
      {/* Reveal + selection */}
      <div className="mt-16">
        <QuoteFlipReveal crew={crew} onDecision={handleDecision} />
      </div>

      {/* Scope block */}
      <section className="mt-20">
        <CardEyebrow>Scope</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          What the crew delivers
        </h2>
        <p className="mt-4 text-ink-muted">{scope.summary}</p>

        <ul className="mt-8 space-y-3">
          {scope.deliverables.map((deliverable) => (
            <li
              key={deliverable}
              className="flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-sm"
            >
              <span
                aria-hidden
                className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-magenta"
              />
              <span className="text-ink">{deliverable}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4">
          <CardEyebrow>Timeline</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">{scope.timeline}</p>
        </div>
      </section>

      {/* Pricing block. Discriminated union: fixed / range / hourly.
          Just the headline + unit label. The 85/15 split isn't
          restated here. Clients receiving a quote already know the
          FM deal structure from the marketing surfaces; repeating
          the percentages on the quote itself reads as marketing
          repetition on a document that should be all business. */}
      <section className="mt-20">
        <CardEyebrow>Pricing</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          {pricingHeadline(pricing)}{" "}
          <span className="text-base font-normal text-ink-muted">
            {pricingUnitLabel(pricing)}
          </span>
        </h2>
      </section>

      {/* Decision panel */}
      <section className="mt-20 rounded-2xl border border-brand-magenta/30 bg-brand-magenta/5 px-6 py-8">
        <h2 className="font-display text-2xl font-semibold text-brand-magenta">
          Ready to $BUILD together?
        </h2>
        {leadName ? (
          <p className="mt-3 max-w-xl text-sm text-ink-muted">
            Lead selected:{" "}
            <strong className="text-ink">{leadName}</strong>. Approve
            below and we&apos;ll kick off contracts + calendar within
            one business day. If you want to iterate on the crew, scope,
            or price first, reply to the email that got you here.
            We&apos;ll adjust and re-send.
          </p>
        ) : (
          <p className="mt-3 max-w-xl text-sm text-ink-muted">
            Pick your lead builder above, then approve the quote. If
            you want to iterate on the crew, scope, or price first,
            reply to the email that got you here. We&apos;ll adjust and
            re-send.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={!selectedLeadUserId || pending}
            className="inline-flex items-center rounded-full bg-brand-magenta px-6 py-2.5 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Approving…"
              : selectedLeadUserId
                ? `Approve · ${leadName}`
                : "Pick a lead first"}
          </button>
          <button
            type="button"
            onClick={() => setShowDeclineForm((v) => !v)}
            disabled={pending}
            className="inline-flex items-center rounded-full border border-[var(--surface-border)] px-6 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-[var(--surface-elevated)] disabled:opacity-60"
          >
            {showDeclineForm ? "Cancel decline" : "Decline"}
          </button>
          <a
            href="mailto:hello@buildstore.example"
            className="inline-flex items-center rounded-full border border-brand-blue/60 px-6 py-2.5 text-sm font-medium text-brand-blue transition-colors hover:bg-brand-blue/10"
          >
            Talk it through first
          </a>
        </div>

        {showDeclineForm && (
          <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4">
            <label
              htmlFor="decline-reason"
              className="text-[11px] uppercase tracking-wider text-ink-muted"
            >
              What would need to change? (optional)
            </label>
            <textarea
              id="decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              placeholder="Crew mix, scope, price, timing, anything worth flagging. Helps us iterate the next pitch."
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleDeclineSubmit}
                disabled={pending}
                className="inline-flex items-center rounded-full bg-ink px-5 py-2 text-xs font-medium text-[var(--surface)] transition-colors hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send decline"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p
            className="mt-4 text-sm"
            style={{ color: "#E53E3E" }}
            role="alert"
          >
            {error}
          </p>
        )}
      </section>
    </>
  );
}
