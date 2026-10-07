"use client";

/**
 * QuoteInteractiveSurface — the client-side shell for /quotes/[token]
 * pre-decision state. Owns the reveal → selection → approve/decline
 * flow end-to-end.
 *
 * Renders:
 *   1. QuoteFlipReveal (reveal moment + TalentHand selection with
 *      per-Builder pricing on each flipped card).
 *   2. Scope block (deliverables + engagement-level timeline rhythm).
 *   3. Aggregate pricing block — derived from the picked hand. Total
 *      updates as the client trims / expands their selection.
 *   4. Decision panel with Approve + Decline buttons + optional
 *      decline reason textarea
 *
 * State model:
 *   - selectedLeadUserId is the "chose" mark from QuoteFlipReveal.
 *     Only one lead can be chosen at a time (single-lead mode). Multi-
 *     role selection lands in a follow-on tier and folds into the same
 *     aggregate math with no schema change.
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

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  QuoteFlipReveal,
  type QuoteFlipReveaCrewMember,
} from "@/components/QuoteFlipReveal";
import { CardEyebrow } from "@/components/Card";
import { StructuredText } from "@/components/StructuredText";
import type { TalentHandDecision } from "@/components/TalentHand";
import { QuoteDecidedUndoButton } from "@/components/QuoteDecidedUndoButton";
import {
  approveCooperativeQuote,
  declineCooperativeQuote,
} from "@/lib/quote-actions";
import {
  aggregateHeadline,
  aggregateUnitLabel,
  deriveAggregatePricing,
} from "@/lib/quote-pricing";
import { publicName, type ProposedBuilder } from "@/lib/types";
import { quoteSignatureStatement } from "@/lib/quote-signature";

interface QuoteInteractiveSurfaceProps {
  clientToken: string;
  /** For the signature statement, which names who is being signed for. */
  clientDisplayName: string;
  scope: {
    summary: string;
    /** Only what spans the whole crew. Per-Builder lists live on
        proposedBuilders. Usually absent. */
    deliverables?: string[];
    /** @deprecated Pre-2026-10-05 quotes only. The engagement timeline
        is read off the Builders the client picks. */
    timeline?: string;
  };
  /**
   * Raw per-Builder pricing shapes — used to derive the aggregate
   * engagement total. The `crew` array is the display projection
   * used by the reveal surface (already carries denormalized quote
   * lines for card render).
   */
  proposedBuilders: ProposedBuilder[];
  crew: QuoteFlipReveaCrewMember[];
  previewOnly?: boolean;
}

export function QuoteInteractiveSurface({
  clientToken,
  clientDisplayName,
  scope,
  proposedBuilders,
  crew,
  previewOnly = false,
}: QuoteInteractiveSurfaceProps) {
  const router = useRouter();
  const [selectedLeadUserId, setSelectedLeadUserId] = useState<string | null>(
    null,
  );
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureTyped, setSignatureTyped] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  // Task #45 captured the SOW contact as free text, then a code-verified
  // session replaced it, then a signature replaced that. See the WHY in
  // approveCooperativeQuote: the link only reaches a decision maker, the
  // close happens on a call, and a verification step in front of a
  // signature taxes every real case to guard against one that does not
  // occur. The signature is the accountability.
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Optimistic post-decision state. Once the server action returns,
  // we flip this so the client shows the confirmation immediately
  // instead of waiting for router.refresh() + server re-render to
  // propagate. When the server render eventually catches up, the
  // parent server component stops rendering this client component
  // entirely (it branches into the approved/declined section based
  // on quote.status), and this state becomes moot.
  const [optimisticDecision, setOptimisticDecision] = useState<
    "approved" | "declined" | null
  >(null);

  // Aggregate engagement pricing — sum of all proposed Builders.
  // Multi-role selection (Tier 21+) will swap this to a picked-only
  // aggregate; the derivation function already handles arbitrary
  // subsets of ProposedBuilders.
  const aggregate = useMemo(
    () => deriveAggregatePricing(proposedBuilders),
    [proposedBuilders],
  );

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

  // Rendered from the same function the action stores, so the wording
  // on screen and the wording on record cannot drift apart.
  const statement = quoteSignatureStatement(clientDisplayName);

  const signatureReady =
    signerName.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail.trim()) &&
    signatureTyped.trim().length >= 3;

  function handleApprove() {
    if (!selectedLeadUserId || pending) return;
    if (!signatureReady) {
      setError("Add your name, email and signature before approving.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("token", clientToken);
    formData.set("selectedLeadUserId", selectedLeadUserId);
    formData.set("clientContactName", signerName.trim());
    formData.set("clientContactEmail", signerEmail.trim());
    formData.set("signatureTyped", signatureTyped.trim());
    startTransition(async () => {
      try {
        await approveCooperativeQuote(formData);
        // Flip optimistic state immediately so the client sees the
        // confirmation without waiting on server-side revalidation.
        // Also call router.refresh() so the parent server component
        // eventually re-renders into the real approved section
        // (which then unmounts this client component).
        setOptimisticDecision("approved");
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
        setOptimisticDecision("declined");
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
    return publicName(found.user);
  })();

  // Optimistic post-decision UI. Runs the moment the server action
  // returns, before the parent server component re-renders. Once the
  // parent's server re-render lands with the real quote.status, the
  // parent stops rendering this client component and the
  // ApprovedSection or DeclinedSection on the server surface takes
  // over. Both branches include the undo affordance so the client
  // isn't stuck if the server refresh lags. The onUndoSuccess callback
  // resets local state so the reveal UI comes back after undoing.
  const handleUndoSuccess = () => {
    setOptimisticDecision(null);
    setSelectedLeadUserId(null);
    setShowDeclineForm(false);
    setDeclineReason("");
  };

  if (optimisticDecision === "approved") {
    return (
      <section className="mt-16 rounded-2xl border border-brand-green/40 bg-brand-green/5 px-6 py-8">
        <CardEyebrow>Approved</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold text-brand-green">
          You&apos;re in. We&apos;re on it.
        </h2>
        {leadName && (
          <p className="mt-4 max-w-xl text-ink-muted">
            Your lead builder is{" "}
            <strong className="text-ink">{leadName}</strong>. We&apos;re
            kicking off contracts and calendar within one business day.
            You&apos;ll hear from Future Modern on email; this same URL
            will evolve into your engagement dashboard so keep it handy.
          </p>
        )}
        <QuoteDecidedUndoButton
          clientToken={clientToken}
          previousDecision="approved"
          onUndoSuccess={handleUndoSuccess}
        />
      </section>
    );
  }

  if (optimisticDecision === "declined") {
    return (
      <section className="mt-16 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-8">
        <CardEyebrow>Declined</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          Thanks for the consideration.
        </h2>
        <p className="mt-4 max-w-xl text-ink-muted">
          No hard feelings. If any of it lands differently later (crew,
          scope, price, timing), reply to the email that got you here
          and we&apos;ll re-pitch. The cooperative isn&apos;t going
          anywhere.
        </p>
        <QuoteDecidedUndoButton
          clientToken={clientToken}
          previousDecision="declined"
          onUndoSuccess={handleUndoSuccess}
        />
      </section>
    );
  }

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
        <StructuredText text={scope.summary} className="mt-4 text-ink-muted" />

        {/* Who owes what. Each Builder bid their own scope, so the
            deliverables sit with the person doing them rather than in
            one flattened list that could not say whose was whose. */}
        <div className="mt-8 space-y-4">
          {crew.map((member) => {
            const builder = proposedBuilders.find(
              (b) => b.userId === member.user.id,
            );
            const items = builder?.deliverables ?? [];
            if (items.length === 0) return null;
            return (
              <div
                key={member.user.id}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {publicName(member.user)}
                  </p>
                  {builder?.timeline && (
                    <p className="text-xs text-ink-muted">{builder.timeline}</p>
                  )}
                </div>
                <ul className="mt-3 space-y-2">
                  {items.map((deliverable) => (
                    <li
                      key={deliverable}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span
                        aria-hidden
                        className="fm-btn-primary mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <span className="text-ink">{deliverable}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Anything the crew owes jointly. Usually empty. */}
        {(scope.deliverables?.length ?? 0) > 0 && (
          <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4">
            <CardEyebrow>Across the engagement</CardEyebrow>
            <ul className="mt-3 space-y-2">
              {scope.deliverables?.map((deliverable) => (
                <li key={deliverable} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden
                    className="fm-btn-primary mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  />
                  <span className="text-ink">{deliverable}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timeline is the sum of its parts, not a number written
            before anyone knew who was doing the work. Pre-2026-10-05
            quotes carry an authored one; those still show it. */}
        {scope.timeline ? (
          <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4">
            <CardEyebrow>Timeline</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">{scope.timeline}</p>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4">
            <CardEyebrow>Timeline</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              Each Builder&apos;s commitment is listed on their card above.
              The engagement takes its shape from the ones you pick.
            </p>
          </div>
        )}
      </section>

      {/* Aggregate pricing block. Derived from sum of per-Builder
          quotes. Fixed + range sum into a numeric total; hourly
          Builders show as pass-through rates alongside. Same math
          as adding up the Quote column on Jamar's Google Doc quote
          sheet, just live. */}
      <section className="mt-20">
        <CardEyebrow>Proposed pricing</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          {aggregateHeadline(aggregate)}
          {aggregateUnitLabel(aggregate) && (
            <span className="ml-3 text-base font-normal text-ink-muted">
              {aggregateUnitLabel(aggregate)}
            </span>
          )}
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-muted">
          These are the Builders&apos; proposed terms. A range or negotiable
          price is settled with the team before contracting; it is not a
          fixed amount due when you choose a crew.
        </p>
      </section>

      {/* Decision panel */}
      {!previewOnly && <section className="mt-20 rounded-2xl border border-brand-magenta/30 bg-brand-magenta/5 px-6 py-8">
        <h2 className="font-display text-2xl font-semibold text-brand-magentaText">
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

        {/* Who the agreement will be addressed to. Not editable here:
            it is the mailbox that answered the code, which is the only
            reason the name on a signed SOW means anything. */}
        {/* Sign here. One screen: who you are, where the copy goes,
            and the signature itself, with the statement shown in full
            above it rather than hidden behind a checkbox. */}
        <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-ink-muted">
            Sign to approve
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            {statement}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                Your name
              </span>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Full name"
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                Email for the signed copy
              </span>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Signature
            </span>
            <input
              type="text"
              value={signatureTyped}
              onChange={(e) => setSignatureTyped(e.target.value)}
              placeholder="Type your name to sign"
              disabled={pending}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border-b-2 border-[var(--surface-border)] bg-transparent px-1 py-2 font-display text-2xl italic text-ink placeholder:text-base placeholder:not-italic placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60"
            />
          </label>
          <p className="mt-2 text-[11px] text-ink-faint">
            Both you and Future Modern receive a signed PDF copy of this
            proposal, including the terms above, as soon as you approve.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={!selectedLeadUserId || pending}
            className="fm-btn-primary inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium shadow-lg shadow-brand-magenta/20 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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
            style={{ color: "var(--fm-red-text)" }}
            role="alert"
          >
            {error}
          </p>
        )}
      </section>}
    </>
  );
}
