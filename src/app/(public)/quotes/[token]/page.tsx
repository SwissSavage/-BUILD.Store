/**
 * /quotes/[token] — the interactive client-facing quote surface.
 *
 * Replaces the old Google Doc quote sheet workflow. Client receives
 * a magic-link, lands on this surface, sees face-down cards, clicks
 * "Reveal your team", flips are staggered to unveil the proposed
 * crew as TradingCards, evaluates the hand in Tinder-style
 * selectable mode (non-destructive), picks their lead, approves the
 * quote (or declines with an optional reason).
 *
 * Per-Builder pricing lands here (Tier 21). Each Builder carries
 * their own price + timeline right on the flipped card — same shape
 * as Jamar's Google Doc quote sheet (Service Provider | Quote |
 * Timeline per row). Engagement total is derived from the picked
 * hand.
 *
 * The same URL is designed to evolve into the ongoing project
 * dashboard after approval. Client keeps coming back to this same
 * link through the engagement lifecycle. Every visit is a stickiness
 * moment for FM. That evolution lands in a follow-on tier; for now
 * this surface handles the pre-approval quote experience plus the
 * post-decision confirmation state.
 *
 * Access is tokenized. No account needed. Same pattern as
 * /invoices/[token], /proposals/[token], /receipts/[token].
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cooperativeQuotes as cooperativeQuotesTable } from "@/db/schema";
import type { ProposedBuilder, CooperativeQuote } from "@/lib/types";
import { getAllUsers } from "@/lib/readers/users";
import { mvpScoreReader, safely } from "@/lib/readers";
import { championsCourtMembers } from "@/lib/mvp-score";
import { deriveTradingCardTier } from "@/components/TradingCard";
import { CardEyebrow, CardTitle } from "@/components/Card";
import type { QuoteFlipReveaCrewMember } from "@/components/QuoteFlipReveal";
import { QuoteInteractiveSurface } from "@/components/QuoteInteractiveSurface";
import { QuoteDecidedUndoButton } from "@/components/QuoteDecidedUndoButton";
import {
  pricingHeadline,
  pricingUnitLabel,
} from "@/lib/quote-pricing";

/**
 * Force-dynamic on this route. The surface is stateful (evolves
 * through the engagement lifecycle) and token-gated (each URL is
 * unique per client). Static rendering with generateStaticParams
 * caused Approve/Decline mutations to not reflect on subsequent
 * renders because the pre-built HTML sat in front of the fresh
 * server render. Explicit force-dynamic guarantees the server
 * component re-runs on every request, which is what we want for
 * a surface that reads mutating state.
 */
export const dynamic = "force-dynamic";

/**
 * generateStaticParams intentionally returns an empty array.
 *
 * Since `dynamic = "force-dynamic"` above forces every request to
 * re-render on the server (necessary because Approve/Decline mutations
 * must reflect immediately), there's no benefit to prebuilding param
 * pages at `next build` time. Previous versions read tokens from
 * Drizzle here for build-time indexability, but that required the DB
 * to be reachable from the build container — which it isn't in
 * Dokploy's isolated build stage. Returning [] keeps builds hermetic.
 * Runtime params still resolve normally via the dynamic segment.
 */
export function generateStaticParams() {
  return [];
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
  // SANDBOX→LIVE swap history:
  //   - Pre-Beta cutover: findCooperativeQuote() lookup against
  //     MOCK_COOPERATIVE_QUOTES.
  //   - Beta cutover (this file, 2026-08-13): reads the row from
  //     Drizzle by client_token. proposedBuilders + scope are jsonb —
  //     cast through the canonical types so downstream code stays
  //     typed. MOCK_USERS lookup for builder identity/tier stays put
  //     for now (users table read-path swap is a separate concern —
  //     the mock is seeded to Postgres at bootstrap so the two agree).
  const [row] = await db
    .select()
    .from(cooperativeQuotesTable)
    .where(eq(cooperativeQuotesTable.clientToken, token))
    .limit(1);
  if (!row) notFound();
  if (row.status === "draft") notFound();

  // Cast jsonb → canonical types. The DB column is typed unknown by
  // Drizzle; the runtime shape is enforced by the authoring flow.
  const quote: CooperativeQuote = {
    id: row.id,
    clientToken: row.clientToken,
    projectId: row.projectId,
    clientDisplayName: row.clientDisplayName,
    proposedBuilders: row.proposedBuilders as ProposedBuilder[],
    scope: row.scope as CooperativeQuote["scope"],
    status: row.status as CooperativeQuote["status"],
    sentAt: row.sentAt,
    viewedAt: row.viewedAt,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    selectedLeadUserId: row.selectedLeadUserId,
  };

  // Build crew members. Resolve users, derive tiers, denormalize
  // per-Builder pricing into a display quoteLine so the client
  // component stays free of pricing-domain imports.
  // Reader swap 2026-08-29: was MOCK_USERS/MOCK_MVP_SCORES. This page
  // is what a CLIENT sees when they open the quote magic-link, so the
  // proposed crew showing seed people rather than the actual builders
  // is the worst-facing version of this bug.
  const [{ users: roster }, allScores] = await Promise.all([
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    safely(() => mvpScoreReader.all(), []),
  ]);
  const scoreById = new Map(allScores.map((sc) => [sc.userId, sc]));

  const courtIds = new Set(championsCourtMembers(allScores, roster));
  const crew: QuoteFlipReveaCrewMember[] = quote.proposedBuilders
    .map((b): QuoteFlipReveaCrewMember | null => {
      const user = roster.find((u) => u.id === b.userId);
      if (!user) return null;
      const mvpSnapshot = scoreById.get(user.id) ?? null;
      const tier = deriveTradingCardTier({
        ovr: mvpSnapshot ? mvpSnapshot.ovr : null,
        isProvisional: mvpSnapshot?.isProvisional ?? false,
        isInChampionsCourt: courtIds.has(user.id),
    membershipTier: user.membershipTier,
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
        relevance: b.relevance,
        quoteLine: {
          pricingHeadline: pricingHeadline(b.pricing),
          pricingUnit: pricingUnitLabel(b.pricing),
          timeline: b.timeline,
        },
      };
    })
    .filter((c): c is QuoteFlipReveaCrewMember => c !== null);

  const decided =
    quote.status === "approved" || quote.status === "declined";
  const selectedLead = quote.selectedLeadUserId
    ? crew.find((c) => c.user.id === quote.selectedLeadUserId) ?? null
    : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header — client + project context */}
      <div>
        <CardEyebrow>Cooperative Quote</CardEyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight md:text-5xl">
          A proposal for {quote.clientDisplayName}
        </h1>
        {!decided && (
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">
            We assembled a crew, wrote the scope, priced each Builder.
            Reveal your team below to see who we&apos;re proposing and
            what each one runs.
          </p>
        )}
      </div>

      {/* Pre-decision: interactive shell */}
      {!decided && (
        <QuoteInteractiveSurface
          clientToken={quote.clientToken}
          scope={quote.scope}
          crew={crew}
          proposedBuilders={quote.proposedBuilders}
        />
      )}

      {/* Post-decision: approved confirmation */}
      {quote.status === "approved" && (
        <section className="mt-16 rounded-2xl border border-brand-green/40 bg-brand-green/5 px-6 py-8">
          <CardEyebrow>Approved</CardEyebrow>
          <h2 className="mt-2 font-display text-3xl font-semibold text-brand-green">
            You&apos;re in. We&apos;re on it.
          </h2>
          {selectedLead && (
            <p className="mt-4 max-w-xl text-ink-muted">
              Your lead builder is{" "}
              <strong className="text-ink">
                {selectedLead.user.firstName} {selectedLead.user.lastName}
              </strong>
              . We&apos;re kicking off contracts and calendar within one
              business day. You&apos;ll hear from Future Modern on
              email; this same URL will evolve into your engagement
              dashboard so keep it handy.
            </p>
          )}
          {quote.decidedAt && (
            <p className="mt-4 text-xs text-ink-faint">
              Approved{" "}
              {new Date(quote.decidedAt).toLocaleString(undefined, {
                dateStyle: "long",
                timeStyle: "short",
              })}
              .
            </p>
          )}
          <QuoteDecidedUndoButton
            clientToken={quote.clientToken}
            previousDecision="approved"
          />
        </section>
      )}

      {/* Post-decision: declined acknowledgment */}
      {quote.status === "declined" && (
        <section className="mt-16 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-8">
          <CardEyebrow>Declined</CardEyebrow>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Thanks for the consideration.
          </h2>
          <p className="mt-4 max-w-xl text-ink-muted">
            No hard feelings. If any of it lands differently later
            (crew, scope, price, timing), reply to the email that got
            you here and we&apos;ll re-pitch. The cooperative
            isn&apos;t going anywhere.
          </p>
          {quote.decidedAt && (
            <p className="mt-4 text-xs text-ink-faint">
              Declined{" "}
              {new Date(quote.decidedAt).toLocaleString(undefined, {
                dateStyle: "long",
                timeStyle: "short",
              })}
              .
            </p>
          )}
          <QuoteDecidedUndoButton
            clientToken={quote.clientToken}
            previousDecision="declined"
          />
        </section>
      )}

      {/* Marketing rail. Stickiness lever. */}
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
              Monthly cohort spotlights of new builders.
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
