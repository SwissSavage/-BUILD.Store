/**
 * /cohort/[period] — single-month cohort spotlight page.
 *
 * `[period]` is a period key like "2026-07". Each spotlight gets its
 * own indexable URL — long-tail SEO surface tied to the specific
 * builders highlighted that month.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { cohortSpotlights } from "@/db/schema";
import { getAllUsers } from "@/lib/readers/users";
import { memberLabel } from "@/lib/member-label";
import { canonizationReader, safely, spotlightReader } from "@/lib/readers";
import { publicName, type User } from "@/lib/types";
import {
  activeRecognitionUserIds,
  publicProfileEligible,
} from "@/lib/profile-visibility";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { OnChainBadge } from "@/components/OnChainBadge";
import { PARAGRAPH_BASE } from "@/lib/mock-data/articles";

export const dynamic = "force-dynamic";

/*
 * generateStaticParams was removed on 2026-09-03.
 *
 * It enumerated periods from the cohort spotlight FIXTURE, so Next
 * pre-built a page for every seed period and none for the real ones.
 * The page is force-dynamic anyway and looks the period up in
 * Postgres below, so the pre-render list was doing nothing except
 * announcing seed periods as real URLs.
 *
 * Pointing it at the database instead would not have helped: CI
 * builds with a dummy DATABASE_URL, so it would enumerate nothing.
 * Rendering on demand is the honest shape for this page.
 */

interface PageProps {
  params: Promise<{ period: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { period } = await params;
  const spotlight = await spotlightReader.one(
    eq(cohortSpotlights.periodKey, period),
  );
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
  const spotlight = await spotlightReader.one(
    eq(cohortSpotlights.periodKey, period),
  );
  if (!spotlight) notFound();

  const { users: roster } = await getAllUsers();
  const recognizedIds = await activeRecognitionUserIds();

  // Canonization counts for the on-chain badge. It takes a count now
  // rather than fetching its own: it renders inside TalentHand, which
  // is a client component, so a read inside the badge pulled `pg`
  // into the client bundle and failed the production build.
  const allCanonizations = await safely(
    () => canonizationReader.all(),
    [],
  );
  const canonCountByUser = new Map<string, number>();
  for (const c of allCanonizations) {
    canonCountByUser.set(c.userId, (canonCountByUser.get(c.userId) ?? 0) + 1);
  }
  const spotlightUsers = spotlight.userIds
    .map((id) => roster.find((u) => u.id === id))
    .filter((u): u is User => !!u);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/cohort"
        className="text-xs uppercase tracking-wider text-ink-muted hover:text-brand-magentaText"
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
              className="text-brand-magentaText hover:underline"
            >
              Read the full piece on Paragraph ↗
            </a>
          </p>
        )}
      </div>

      {spotlightUsers.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-brand-magentaText">
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
                        <OnChainBadge count={canonCountByUser.get(user.id) ?? 0} size="sm" />
                      </div>
                      {memberLabel(user) && (
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {memberLabel(user)}
                        </p>
                      )}
                      {user.bio && (
                        <p className="mt-2 text-sm text-ink-muted">
                          {user.bio}
                        </p>
                      )}
                      {publicProfileEligible(user, recognizedIds) && (
                        <Link
                          href={`/u/${user.handle}`}
                          className="mt-2 inline-block text-xs text-brand-magentaText hover:underline"
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
        <h2 className="font-display text-xl font-semibold text-brand-magentaText">
          Want to join?
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          The cooperative grows through invitation, application, and
          contribution. The whitelist is the front door.
        </p>
        <Link
          href="/whitelist"
          className="fm-btn-primary mt-4 inline-flex items-center rounded-full px-5 py-2 text-sm font-medium shadow-lg shadow-brand-magenta/20 transition-colors"
        >
          Apply to the whitelist →
        </Link>
      </div>
    </div>
  );
}
