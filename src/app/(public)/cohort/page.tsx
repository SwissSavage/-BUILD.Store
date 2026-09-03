/**
 * /cohort — monthly onboarding spotlight index.
 *
 * The forward-looking editorial rail. Every month, one or two new
 * builders get a spotlight — the story of who they are, why the
 * cooperative is glad to have them, what they're bringing.
 *
 * Complements /showcase (browsable talent), /team (full member roster
 * for signed-in Members), Future Modernist of the Month (recognition
 * for shipped work), and annual Canonization (year-end standing
 * minted on-chain).
 *
 * Rolling content engine — always something new because real people
 * are actually joining. Every spotlight is an indexable landing page
 * ranking for the builder's name plus their discipline.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { getAllUsers } from "@/lib/readers/users";
import { memberLabel } from "@/lib/member-label";
import { spotlightReader, safely } from "@/lib/readers";
import {
  activeRecognitionUserIds,
  publicProfileEligible,
} from "@/lib/profile-visibility";
import { publicName } from "@/lib/types";
import {
  Card,
  CardEyebrow,
  CardTitle,
} from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { OnChainBadge } from "@/components/OnChainBadge";

export const dynamic = "force-dynamic";

/** Static-rendered. Reads a build-time array. */

export const metadata: Metadata = {
  title: "Cohort",
  description:
    "Monthly onboarding spotlights on new builders joining Future Modern in real time. Who they are, what they're bringing, why the cooperative is glad to have them.",
};

export default async function CohortIndexPage() {
  const [allSpotlights, { users: roster }, recognizedIds] = await Promise.all([
    safely(() => spotlightReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    safely(() => activeRecognitionUserIds(), new Set<string>()),
  ]);
  const spotlights = [...allSpotlights].sort((a, b) =>
    b.periodKey.localeCompare(a.periodKey),
  );

  // ─────────────────────────────────────────────────────────────
  // WHY THIS LISTS PEOPLE, NOT JUST SPOTLIGHTS (2026-09-02)
  //
  // This page only rendered curated cohort_spotlights rows. None have
  // ever been written, so it showed "No cohort spotlights on record
  // yet" while eleven people had in fact joined. The homepage links
  // here as "Everyone who has joined", and Jamar clicked it: "The top
  // right button doesn't lead to anything which is weird."
  //
  // Same rule as the rail: curation adds, it never subtracts. Everyone
  // eligible is grouped by the month they joined, and a curated
  // spotlight for a month is shown alongside its people rather than
  // instead of them.
  // ─────────────────────────────────────────────────────────────
  const eligible = roster
    .filter((u) => publicProfileEligible(u, recognizedIds))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const byMonth = new Map<string, typeof eligible>();
  for (const u of eligible) {
    const key = (u.createdAt ?? "").slice(0, 7) || "unknown";
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(u);
    else byMonth.set(key, [u]);
  }
  const months = [...byMonth.entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  );
  const monthLabel = (key: string) => {
    const d = new Date(`${key}-01T00:00:00.000Z`);
    return Number.isNaN(d.getTime())
      ? key
      : d.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <CardEyebrow>Cohort</CardEyebrow>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-tight">
        Who&apos;s joining the cooperative
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-muted">
        Monthly spotlights on the builders arriving in real time.
        The cooperative grows by considered addition, not open
        registration. This rail is how the network sees new
        Members and Partners as they land.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-sm text-ink-muted">
        <p>
          This is the forward-looking rail. For recognition of shipped
          work, see the{" "}
          <Link
            href="/portfolio"
            className="text-brand-magentaText hover:underline"
          >
            Future Modernist rail
          </Link>
          {" "}on the showcase. For year-end canonization, see the
          Constellation of the Year run each December.
        </p>
      </div>

      {months.length === 0 ? (
        <Card className="mt-12">
          <p className="text-sm text-ink-muted">
            Nobody has joined yet.
          </p>
        </Card>
      ) : (
        <ol className="mt-12 space-y-12">
          {months.map(([key, people]) => {
            const curated = spotlights.find((sp) => sp.periodKey === key);
            return (
              <li key={key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-2xl font-semibold">
                    {monthLabel(key)}
                  </h2>
                  <span className="text-xs text-ink-faint">
                    {people.length}{" "}
                    {people.length === 1 ? "builder" : "builders"}
                  </span>
                </div>

                {curated && (
                  <Link
                    href={`/cohort/${curated.periodKey}`}
                    className="mt-3 block"
                  >
                    <Card className="transition-colors hover:border-brand-magenta/50">
                      <p className="font-display text-lg font-semibold">
                        {curated.headline}
                      </p>
                      {curated.narrative && (
                        <p className="mt-1 text-sm text-ink-muted">
                          {curated.narrative}
                        </p>
                      )}
                      <span className="mt-2 inline-block text-sm text-brand-magentaText">
                        Read the spotlight →
                      </span>
                    </Card>
                  </Link>
                )}

                <ul className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {people.map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/u/${u.handle}`}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 hover:border-brand-magenta/50"
                      >
                        <Avatar user={u} size="md" />
                        <div className="min-w-0">
                          <p className="truncate font-display text-base font-semibold">
                            {publicName(u)}
                          </p>
                          {memberLabel(u) && (
                            <p className="truncate text-xs text-ink-muted">
                              {memberLabel(u)}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}

    </div>
  );
}
