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
import {
  MOCK_COOPERATIVE_QUOTES,
  findCooperativeQuote,
} from "@/lib/mock-data/cooperative-quotes";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_MVP_SCORES, mvpScoreForUser } from "@/lib/mock-data/mvp-scores";
import { championsCourtMembers } from "@/lib/mvp-score";
import { deriveTradingCardTier } from "@/components/TradingCard";
import { CardEyebrow, CardTitle } from "@/components/Card";
import type { QuoteFlipReveaCrewMember } from "@/components/QuoteFlipReveal";
import { QuoteInteractiveSurface } from "@/components/QuoteInteractiveSurface";

/**
 * Server-rendered per request. The old `force-static` posture broke
 * the client-facing Approve/Decline flow because revalidatePath after
 * the server action didn't reliably regenerate the pre-built page in
 * dev, so clients saw "nothing happen" on click. Since the surface is
 * inherently stateful (evolves through the engagement lifecycle) and
 * token-gated (each URL is unique), static generation was the wrong
 * default anyway.
 *
 * generateStaticParams stays for the build-time indexability of known
 * tokens even without force-static; Next.js will still pre-render on
 * first request per token and serve subsequent requests from the
 * fresh render.
 */

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

  // Build crew members. Resolve users, derive tiers, layer in
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
            We assembled a crew, wrote the scope, priced the engagement.
            Reveal your team below to see who we&apos;re proposing.
          </p>
        )}
      </div>

      {/* Pre-decision: interactive shell */}
      {!decided && (
        <QuoteInteractiveSurface
          clientToken={quote.clientToken}
          scope={quote.scope}
          pricing={quote.pricing}
          crew={crew}
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
        </section>
      )}

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

