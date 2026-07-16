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
import { cohortSpotlightsByRecency } from "@/lib/mock-data/cohort-spotlights";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { publicName } from "@/lib/types";
import {
  Card,
  CardEyebrow,
  CardTitle,
} from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { OnChainBadge } from "@/components/OnChainBadge";

/** Static-rendered. Reads a build-time array. */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Cohort",
  description:
    "Monthly onboarding spotlights on new builders joining Future Modern in real time. Who they are, what they're bringing, why the cooperative is glad to have them.",
};

export default function CohortIndexPage() {
  const spotlights = cohortSpotlightsByRecency();

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
            href="/showcase"
            className="text-brand-magenta hover:underline"
          >
            Future Modernist rail
          </Link>
          {" "}on the showcase. For year-end canonization, see the
          Constellation of the Year run each December.
        </p>
      </div>

      {spotlights.length === 0 ? (
        <Card className="mt-12">
          <p className="text-sm text-ink-muted">
            No cohort spotlights on record yet. The rail starts as the
            cooperative onboards.
          </p>
        </Card>
      ) : (
        <ol className="mt-12 space-y-6">
          {spotlights.map((spotlight) => {
            const spotlightUsers = spotlight.userIds
              .map((id) => MOCK_USERS.find((u) => u.id === id))
              .filter((u): u is (typeof MOCK_USERS)[number] => !!u);

            return (
              <li key={spotlight.id}>
                <Link
                  href={`/cohort/${spotlight.periodKey}`}
                  className="block"
                >
                  <Card className="transition-colors hover:border-brand-magenta/50">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardEyebrow>{spotlight.periodLabel}</CardEyebrow>
                      <span className="text-[11px] text-ink-faint">
                        {spotlightUsers.length}{" "}
                        {spotlightUsers.length === 1
                          ? "builder"
                          : "builders"}
                      </span>
                    </div>
                    <CardTitle className="mt-1 text-xl">
                      {spotlight.headline}
                    </CardTitle>
                    <p className="mt-3 text-sm text-ink-muted">
                      {spotlight.narrative}
                    </p>

                    {spotlightUsers.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-3">
                        {spotlightUsers.map((user) => (
                          <li
                            key={user.id}
                            className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-1 text-xs"
                          >
                            <Avatar user={user} size="sm" />
                            <span className="font-medium text-ink">
                              {publicName(user)}
                            </span>
                            {user.discipline && (
                              <span className="text-ink-muted">
                                · {user.discipline}
                              </span>
                            )}
                            <OnChainBadge userId={user.id} size="sm" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
