/**
 * /cohort/[period] — single-month cohort spotlight page.
 *
 * `[period]` is a period key like "2026-07". Each spotlight gets its
 * own indexable URL — long-tail SEO surface tied to the specific
 * cooperators highlighted that month.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  cohortSpotlightsByRecency,
  findCohortSpotlight,
} from "@/lib/mock-data/cohort-spotlights";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { publicName, type User } from "@/lib/types";
import { publicProfileEligible } from "@/lib/profile-visibility";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { OnChainBadge } from "@/components/OnChainBadge";
import { PARAGRAPH_BASE } from "@/lib/mock-data/articles";

/** Static-rendered — reads build-time arrays. */
export const dynamic = "force-static";

/**
 * Pre-generate the static params for every known period so Next
 * builds a page for each spotlight at build time.
 */
export function generateStaticParams() {
  return cohortSpotlightsByRecency().map((s) => ({ period: s.periodKey }));
}

interface PageProps {
  params: Promise<{ period: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { period } = await params;
  const spotlight = findCohortSpotlight(period);
  if (!spotlight) {
    return { title: "Cohort spotlight" };
  }
  return {
    title: `${spotlight.headline} · ${spotlight.periodLabel}`,
    description: spotlight.narrative,
  };
}

export default async function CohortSpotlightPage({ params }: PageProps) {
  const { period } = await params;
  const spotlight = findCohortSpotlight(period);
  if (!spotlight) notFound();

  const spotlightUsers = spotlight.userIds
    .map((id) => MOCK_USERS.find((u) => u.id === id))
    .filter((u): u is User => !!u);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/cohort"
        className="text-xs uppercase tracking-wider text-ink-muted hover:text-brand-magenta"
      >
        ← All cohort spotlights
      </Link>

      <div className="mt-6">
        <CardEyebrow>{spotlight.periodLabel}</CardEyebrow>
        <h1 className="mt-2 font-display text-5xl font-semibold leading-tight">
          {spotlight.headline}
        </h1>
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-6">
        <p className="text-lg text-ink-muted">{spotlight.narrative}</p>

        {spotlight.paragraphSlug && (
          <p className="mt-4 text-sm">
            <a
              href={`${PARAGRAPH_BASE}/${spotlight.paragraphSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-magenta hover:underline"
            >
              Read the full piece on Paragraph ↗
            </a>
          </p>
        )}
      </div>

      {spotlightUsers.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-brand-magenta">
            {spotlightUsers.length === 1
              ? "In the cooperative"
              : "In the cooperative this month"}
          </h2>
          <ul className="mt-4 space-y-3">
            {spotlightUsers.map((user) => (
              <li key={user.id}>
                <Card className="transition-colors hover:border-brand-magenta/50">
                  <div className="flex items-start gap-4">
                    <Avatar user={user} size="lg" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <CardTitle className="text-lg">
                          {publicName(user)}
                        </CardTitle>
                        <OnChainBadge userId={user.id} size="sm" />
                      </div>
                      {user.discipline && (
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {user.discipline}
                        </p>
                      )}
                      {user.bio && (
                        <p className="mt-2 text-sm text-ink-muted">
                          {user.bio}
                        </p>
                      )}
                      {publicProfileEligible(user) && (
                        <Link
                          href={`/u/${user.handle}`}
                          className="mt-2 inline-block text-xs text-brand-magenta hover:underline"
                        >
                          Visit profile →
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-16 rounded-2xl border border-brand-magenta/30 bg-brand-magenta/5 px-6 py-6">
        <h2 className="font-display text-xl font-semibold text-brand-magenta">
          Want to join?
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          The cooperative grows through invitation, application, and
          contribution. The whitelist is the front door.
        </p>
        <Link
          href="/whitelist"
          className="mt-4 inline-flex items-center rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
        >
          Apply to the whitelist →
        </Link>
      </div>
    </div>
  );
}
