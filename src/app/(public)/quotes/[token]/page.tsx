/**
 * /quotes/[token] — the interactive client-facing quote surface.
 *
 * Replaces the old Google Doc quote sheet workflow. Client receives
 * a magic-link, lands on this surface, sees face-down cards, clicks
 * "Reveal your team", flips are staggered to unveil the proposed
 * crew as TradingCards, evaluates the hand in Tinder-style
 * selectable mode (non-destructive), picks their lead, approves the
 * quote.
 *
 * The same URL is designed to evolve into the ongoing project
 * dashboard after approval — client keeps coming back to this same
 * link through the engagement lifecycle. Every visit is a stickiness
 * moment for FM. That evolution lands in a follow-on tier; for now
 * this surface handles the pre-approval quote experience.
 *
 * Access is tokenized — no account needed. Same pattern as
 * /invoices/[token], /proposals/[token], /receipts/[token].
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  MOCK_COOPERATIVE_QUOTES,
  findCooperativeQuote,
} from "@/lib/mock-data/cooperative-quotes";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_MVP_SCORES, mvpScoreForUser } from "@/lib/mock-data/mvp-scores";
import { championsCourtMembers } from "@/lib/mvp-score";
import { deriveTradingCardTier } from "@/components/TradingCard";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { QuoteFlipReveal, type QuoteFlipReveaCrewMember } from "@/components/QuoteFlipReveal";

/** Static per-token — one page pre-built per known quote. */
export const dynamic = "force-static";

/**
 * Pre-generate one page per known quote token. Production swaps to a
 * Drizzle query on `cooperative_quotes.client_token`.
 */
export function generateStaticParams() {
  return MOCK_COOPERATIVE_QUOTES.map((q) => ({ token: q.clientToken }));
}

export const metadata: Metadata = {
  title: "Your team",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CooperativeQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = findCooperativeQuote(token);
  if (!quote) notFound();
  if (quote.status === "draft") notFound();

  // Build crew members — resolve users, derive tiers, layer in
  // per-member relevance narrative.
  const courtIds = new Set(championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS));
  const crew: QuoteFlipReveaCrewMember[] = quote.proposedMemberIds
    .map((memberId): QuoteFlipReveaCrewMember | null => {
      const user = MOCK_USERS.find((u) => u.id === memberId);
      if (!user) return null;
      const mvpSnapshot = mvpScoreForUser(user.id);
      const tier = deriveTradingCardTier({
        ovr: mvpSnapshot ? mvpSnapshot.ovr : null,
        isProvisional: mvpSnapshot?.isProvisional ?? false,
        isInChampionsCourt: courtIds.has(user.id),
      });
      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          handle: user.handle,
          profileImageUrl: user.profileImageUrl,
          avatarPortraitUrl: user.avatarPortraitUrl,
          discipline: user.discipline,
          membershipTier: user.membershipTier,
        },
        tier,
        relevance:
          quote.memberRelevance[user.id] ??
          "Proposed for this engagement based on skill match.",
      };
    })
    .filter((c): c is QuoteFlipReveaCrewMember => c !== null);

  const talentSplitDollars = Math.round(
    (quote.pricing.baseAmount * quote.pricing.talentSplit) / 100,
  );
  const opsSplitDollars = Math.round(
    (quote.pricing.baseAmount * quote.pricing.operationsSplit) / 100,
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header — client + project context */}
      <div>
        <CardEyebrow>Cooperative Quote</CardEyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight md:text-5xl">
          A proposal for {quote.clientDisplayName}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          We assembled a crew, wrote the scope, priced the engagement.
          Reveal your team below to see who we&apos;re proposing.
        </p>
      </div>

      {/* The reveal — flip animation + TalentHand for selection */}
      <div className="mt-16">
        <QuoteFlipReveal crew={crew} />
      </div>

      {/* Scope block */}
      <section className="mt-20">
        <CardEyebrow>Scope</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          What the crew delivers
        </h2>
        <p className="mt-4 text-ink-muted">{quote.scope.summary}</p>

        <ul className="mt-8 space-y-3">
          {quote.scope.deliverables.map((deliverable) => (
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
          <p className="mt-2 text-sm text-ink-muted">
            {quote.scope.timeline}
          </p>
        </div>
      </section>

      {/* Pricing block — visible 85/15 split */}
      <section className="mt-20">
        <CardEyebrow>Pricing</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          ${quote.pricing.baseAmount.toLocaleString()}{" "}
          <span className="text-base font-normal text-ink-muted">
            total contract value
          </span>
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardEyebrow>Direct to cooperators</CardEyebrow>
            <p className="mt-2 font-display text-3xl font-semibold text-brand-green">
              {quote.pricing.talentSplit}%
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              ${talentSplitDollars.toLocaleString()} paid directly to the
              crew who ships the work. No agency middleman, no platform
              take-rate stacked on top.
            </p>
          </Card>
          <Card>
            <CardEyebrow>Cooperative operations</CardEyebrow>
            <p className="mt-2 font-display text-3xl font-semibold text-brand-blue">
              {quote.pricing.operationsSplit}%
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              ${opsSplitDollars.toLocaleString()} funds shared cooperative
              operations: matching, coordination, treasury reserve, tools
              every Member relies on.
            </p>
          </Card>
        </div>
      </section>

      {/* Decision + follow-up */}
      <section className="mt-20 rounded-2xl border border-brand-magenta/30 bg-brand-magenta/5 px-6 py-8">
        <h2 className="font-display text-2xl font-semibold text-brand-magenta">
          Ready to $BUILD together?
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-muted">
          Pick your lead cooperator above, then approve the quote. On
          approval, we kick off contracts + calendar within one business
          day. If you want to iterate on the crew, scope, or price
          first, reply to the email that got you here. We&apos;ll
          adjust and re-send.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-full bg-brand-magenta px-6 py-2.5 text-sm font-medium text-brand-white opacity-60 shadow-lg shadow-brand-magenta/20"
            title="Sandbox. Approve action lands with the admin flow."
          >
            Approve quote
          </button>
          <a
            href="mailto:hello@buildstore.example"
            className="inline-flex items-center rounded-full border border-brand-blue/60 px-6 py-2.5 text-sm font-medium text-brand-blue transition-colors hover:bg-brand-blue/10"
          >
            Talk it through first
          </a>
        </div>
        <p className="mt-4 text-[11px] text-ink-faint">
          Sandbox surface. The Approve action wires to a real client-
          decision server action at production.
        </p>
      </section>

      {/* Marketing rail — stickiness lever */}
      <section className="mt-20 border-t border-[var(--surface-border)] pt-12">
        <p className="text-[11px] uppercase tracking-[0.15em] text-ink-muted">
          More from the cooperative
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Link
            href="/governance"
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-sm transition-colors hover:border-brand-magenta"
          >
            <CardTitle className="text-base">How the model works</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              The Venture Labor OS. Governance, tiers, canon.
            </p>
          </Link>
          <Link
            href="/articles"
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-sm transition-colors hover:border-brand-magenta"
          >
            <CardTitle className="text-base">Articles</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              The Future Modern archive from Paragraph.
            </p>
          </Link>
          <Link
            href="/cohort"
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-sm transition-colors hover:border-brand-magenta"
          >
            <CardTitle className="text-base">
              Who&apos;s joining
            </CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              Monthly cohort spotlights of new cooperators.
            </p>
          </Link>
          <Link
            href="/trust"
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-sm transition-colors hover:border-brand-magenta"
          >
            <CardTitle className="text-base">Trust & security</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              Procurement-facing security + privacy posture.
            </p>
          </Link>
        </div>
      </section>

      <p className="mt-16 text-center text-[10px] uppercase tracking-wider text-ink-faint">
        Cooperative Quote · Confidential to {quote.clientDisplayName} ·
        Not a contract
      </p>
    </div>
  );
}
