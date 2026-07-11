/**
 * /team — cooperative member directory.
 *
 * Member-only surface listing every active Member of the cooperative
 * (plus Partners with active recognition windows per the visibility
 * matrix). Each row renders the Member's trading card at grid scale
 * with tier + discipline + pillar overlays; clicking through goes to
 * their /u/[handle] profile.
 *
 * Pillar filter (STEM / Creative Media / Professional Services) uses
 * the search param convention already established on /showcase.
 *
 * Auth: Member-tier or admin. Partners route to the public /showcase
 * for portfolio browsing instead.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { mvpScoreForUser, MOCK_MVP_SCORES } from "@/lib/mock-data/mvp-scores";
import { championsCourtMembers } from "@/lib/mvp-score";
import { publicProfileEligible } from "@/lib/profile-visibility";
import {
  INDUSTRY_LABELS,
  publicName,
  userPillars,
  type Industry,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  TradingCard,
  deriveTradingCardTier,
  type TradingCardTier,
} from "@/components/TradingCard";
import { OnChainBadge } from "@/components/OnChainBadge";

const PILLAR_ORDER: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

function parsePillar(raw: string | undefined): Industry | null {
  if (!raw) return null;
  return PILLAR_ORDER.includes(raw as Industry) ? (raw as Industry) : null;
}

const TIER_RANK: Record<TradingCardTier, number> = {
  champion: 5,
  future_modernist: 4,
  promotion_eligible: 3,
  good_standing: 2,
  probation: 1,
  standard: 0,
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ pillar?: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/signin?next=/team");

  if (viewer.membershipTier !== "member" && !viewer.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          Members-only directory
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          The cooperative roster is a Member-tier surface. Public
          browsing of the cooperative&apos;s work lives at{" "}
          <Link href="/showcase" className="text-brand-magenta hover:underline">
            /showcase
          </Link>
          .
        </p>
      </div>
    );
  }

  const { pillar: raw } = await searchParams;
  const activePillar = parsePillar(raw);

  const courtIds = new Set(championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS));

  // Roster = discovery-eligible users. Members always qualify; recognized
  // Partners do too during their window.
  const roster = MOCK_USERS.filter((u) => publicProfileEligible(u))
    .map((u) => {
      const pillars = userPillars(u);
      const snapshot = mvpScoreForUser(u.id);
      const tier = deriveTradingCardTier({
        ovr: snapshot?.ovr ?? null,
        isProvisional: snapshot?.isProvisional ?? false,
        isInChampionsCourt: courtIds.has(u.id),
      });
      return { user: u, pillars, tier };
    })
    .filter((r) =>
      activePillar ? r.pillars.includes(activePillar) : true,
    )
    .sort((a, b) => {
      // Higher tier first, then alphabetical.
      const tierDelta = TIER_RANK[b.tier] - TIER_RANK[a.tier];
      if (tierDelta !== 0) return tierDelta;
      return publicName(a.user).localeCompare(publicName(b.user));
    });

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold">
            Cooperative roster
          </h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Every active Member of Future Modern plus Partners with
            active recognition windows. Ranked by tier. Champion&apos;s
            Court holographic-gold cards at the top, then Future
            Modernist pool, promotion-eligible, and good standing.
          </p>
        </div>
        <Link
          href="/calendar"
          className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magenta"
        >
          Shared calendar →
        </Link>
      </div>

      {/* Pillar filter */}
      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        <FilterPill label="All pillars" href="/team" active={!activePillar} />
        {PILLAR_ORDER.map((p) => (
          <FilterPill
            key={p}
            label={INDUSTRY_LABELS[p]}
            href={`/team?pillar=${p}`}
            active={activePillar === p}
          />
        ))}
        <span className="ml-auto text-[11px] text-ink-faint">
          {roster.length} on roster
        </span>
      </div>

      {/* Roster grid */}
      {roster.length === 0 ? (
        <Card className="mt-8">
          <p className="text-sm text-ink-muted">
            No Members match that pillar filter yet.
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {roster.map(({ user, pillars, tier }) => (
            <Link
              key={user.id}
              href={`/u/${user.handle}`}
              className="group block"
            >
              <TradingCard
                user={user}
                tier={tier}
                aspectRatio="3/4"
                className="transition-transform group-hover:-translate-y-1"
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between text-white">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                    >
                      {user.membershipTier}
                    </span>
                  </div>
                </div>
              </TradingCard>
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <CardTitle className="text-base">
                    {publicName(user)}
                  </CardTitle>
                  <OnChainBadge userId={user.id} size="sm" />
                </div>
                {user.discipline && (
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {user.discipline}
                  </p>
                )}
                {pillars.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pillars.map((p) => (
                      <span
                        key={p}
                        className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[10px]"
                      >
                        {INDUSTRY_LABELS[p]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card className="mt-12">
        <CardEyebrow>Not on here?</CardEyebrow>
        <CardTitle className="mt-1 text-lg">
          The roster reflects public discovery eligibility
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Members always appear (unless they&apos;ve opted out of
          discovery via the profile-public flag). Partners appear
          during active recognition windows. Win a Future Modernist
          spot and your profile lists here for the window. Prospects
          and Viewers aren&apos;t on the roster; they&apos;re
          pre-Member.
        </p>
      </Card>
    </div>
  );
}

function FilterPill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 transition-colors ${
        active
          ? "border-brand-magenta bg-brand-magenta text-white"
          : "border-[var(--surface-border)] hover:border-brand-magenta hover:text-brand-magenta"
      }`}
    >
      {label}
    </Link>
  );
}
