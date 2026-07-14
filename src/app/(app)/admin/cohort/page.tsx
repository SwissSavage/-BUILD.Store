/**
 * /admin/cohort — cohort spotlight authoring surface.
 *
 * The admin-facing companion to the public /cohort rail. Lists
 * existing spotlights (freshest first) with a remove action, plus a
 * form to author a new one.
 *
 * The forward-looking editorial rail. When a new builder joins the
 * cooperative, an admin authors a spotlight here — headline, narrative,
 * period, one to three highlighted builders, optional Paragraph
 * link. Publishing appears immediately on /cohort and on the landing
 * page's current-month rail.
 *
 * Gated to admin. Every action writes to the audit log via
 * `cohort.spotlight_created` and `cohort.spotlight_removed`.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  cohortSpotlightsByRecency,
} from "@/lib/mock-data/cohort-spotlights";
import { publicName } from "@/lib/types";
import {
  createCohortSpotlight,
  removeCohortSpotlight,
} from "@/lib/cohort-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

/**
 * Pick candidate builders for spotlighting. Members + Partners
 * (spotlight is meant for builders, not prospects/viewers) sorted
 * by name for a predictable form. Admins can spotlight themselves —
 * useful when a founding Member wants to acknowledge their own
 * onboarding period.
 */
function spotlightCandidates() {
  return [...MOCK_USERS]
    .filter(
      (u) =>
        u.membershipTier === "member" || u.membershipTier === "partner",
    )
    .sort((a, b) =>
      publicName(a).localeCompare(publicName(b), "en", { sensitivity: "base" }),
    );
}

/**
 * Compute a default period key — current year-month — so the form
 * starts with a sensible value the admin can override.
 */
function currentPeriodKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export default async function AdminCohortPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/cohort");

  const spotlights = cohortSpotlightsByRecency();
  const candidates = spotlightCandidates();
  const defaultPeriod = currentPeriodKey();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Cohort spotlights</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Onboarding rail
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Author the monthly onboarding spotlight — the forward-looking
            rail highlighting builders arriving in real time.
            Different rhythm from{" "}
            <Link
              href="/admin/mvp/recognition"
              className="text-brand-magenta hover:underline"
            >
              Future Modernist of the Month
            </Link>{" "}
            (recognition for shipped work) and{" "}
            <Link
              href="/admin/mvp/canonization"
              className="text-brand-magenta hover:underline"
            >
              annual Canonization
            </Link>{" "}
            (year-end standing minted on-chain).
          </p>
        </div>
        <Link
          href="/cohort"
          className="text-sm text-brand-magenta hover:underline"
        >
          View public rail →
        </Link>
      </div>

      {/* Author a new spotlight */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Author a new spotlight
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          One period per spotlight. Duplicate spotlights on the same
          period are blocked — remove the existing one first if the
          plan changes.
        </p>

        <form
          action={createCohortSpotlight}
          className="mt-6 space-y-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
        >
          <div>
            <label
              htmlFor="periodKey"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Period (year-month)
            </label>
            <input
              id="periodKey"
              name="periodKey"
              type="text"
              defaultValue={defaultPeriod}
              placeholder="2026-07"
              pattern="\d{4}-\d{2}"
              required
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Format: YYYY-MM. Default is the current month.
            </p>
          </div>

          <div>
            <label
              htmlFor="headline"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Headline
            </label>
            <input
              id="headline"
              name="headline"
              type="text"
              placeholder="Bayu joins the cooperative"
              required
              minLength={6}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="narrative"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Narrative
            </label>
            <textarea
              id="narrative"
              name="narrative"
              rows={5}
              placeholder="Who they are, what they're bringing, why the cooperative is glad to have them. Kept concise; first-name basis."
              required
              minLength={50}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Minimum 50 characters. First-name only for builders.
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-muted">
              Builders to spotlight (1-3)
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {candidates.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm hover:border-brand-magenta/50"
                >
                  <input
                    type="checkbox"
                    name="userIds"
                    value={user.id}
                    className="h-4 w-4"
                  />
                  <Avatar user={user} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {publicName(user)}
                    </p>
                    {user.discipline && (
                      <p className="truncate text-[11px] text-ink-faint">
                        {user.discipline}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="paragraphSlug"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Paragraph slug (optional)
            </label>
            <input
              id="paragraphSlug"
              name="paragraphSlug"
              type="text"
              placeholder="bayu-joins-the-cooperative"
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Link to a Paragraph piece if one has been published.
              Leave blank if not.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              Publish spotlight
            </button>
          </div>
        </form>
      </section>

      {/* Existing spotlights */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Existing spotlights
        </h2>
        {spotlights.length === 0 ? (
          <Card className="mt-6">
            <p className="text-sm text-ink-muted">
              No cohort spotlights on record yet. Author the first one
              above.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 space-y-4">
            {spotlights.map((spotlight) => {
              const spotlightUsers = spotlight.userIds
                .map((id) => MOCK_USERS.find((u) => u.id === id))
                .filter((u): u is (typeof MOCK_USERS)[number] => !!u);

              return (
                <li key={spotlight.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardEyebrow>{spotlight.periodLabel}</CardEyebrow>
                      <span className="text-[11px] text-ink-faint">
                        Published{" "}
                        {new Date(spotlight.publishedAt).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </span>
                    </div>
                    <CardTitle className="mt-1 text-lg">
                      {spotlight.headline}
                    </CardTitle>
                    <p className="mt-2 text-sm text-ink-muted">
                      {spotlight.narrative}
                    </p>

                    {spotlightUsers.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {spotlightUsers.map((user) => (
                          <li
                            key={user.id}
                            className="flex items-center gap-2 rounded-full bg-[var(--surface-inset)] px-3 py-1 text-xs"
                          >
                            <Avatar user={user} size="sm" />
                            <span>{publicName(user)}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={`/cohort/${spotlight.periodKey}`}
                        className="text-xs text-brand-magenta hover:underline"
                      >
                        View public page →
                      </Link>
                      <form action={removeCohortSpotlight}>
                        <input
                          type="hidden"
                          name="id"
                          value={spotlight.id}
                        />
                        <button
                          type="submit"
                          className="text-xs text-ink-faint hover:text-brand-magenta"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
