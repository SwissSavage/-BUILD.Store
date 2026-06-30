/**
 * Admin: Future Modernist recognition rail.
 *
 * Selects monthly + annual recognition winners from the MVP shortlist
 * (top 5 OVR snapshots in the period, non-provisional). Admin writes an
 * editorial narrative published alongside the recognition.
 *
 * Selection mechanism: Phase 1 admin pick (current); Phase 2 Member vote
 * (Member-count gated, ~15-25 voting Members threshold). Vote phase
 * doesn't change the route — the form swaps to a tally surface.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_MVP_SCORES } from "@/lib/mock-data/mvp-scores";
import {
  MOCK_FUTURE_MODERNIST_RECOGNITIONS,
  periodKeyFor,
  recentRecognitions,
  recognitionForPeriod,
} from "@/lib/mock-data/future-modernist-recognitions";
import {
  selectFutureModernist,
  rescindFutureModernist,
} from "@/lib/future-modernist-actions";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const SHORTLIST_SIZE = 5;

export default async function AdminFutureModernistPage() {
  await requireAdmin();

  // Metric-driven suggestion: top 5 by OVR, non-provisional. Surfaces
  // as an informational shortlist on the form — admin can pick from here
  // if they want to lean on the data. Partner-tier candidates aren't on
  // the MVP shortlist (Partners don't get OVR scores per the locked tier
  // matrix), but the selection form's universe is open to ALL active
  // users so admin can recognize Partners by editorial judgment.
  const shortlist = MOCK_MVP_SCORES.filter((s) => !s.isProvisional)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, SHORTLIST_SIZE);

  // Recognition-eligible universe: all active users (Members + Partners).
  // Excludes prospects/viewers and self-managed admins who are operations
  // accounts rather than recognized contributors.
  const eligibleUsers = MOCK_USERS.filter(
    (u) =>
      u.membershipTier === "member" || u.membershipTier === "partner",
  );

  const now = new Date();
  const monthKey = periodKeyFor(now, "month");
  const yearKey = periodKeyFor(now, "year");
  const currentMonthWinner = recognitionForPeriod(monthKey.key, "month");
  const currentYearWinner = recognitionForPeriod(yearKey.key, "year");

  const recent = recentRecognitions(12);
  void MOCK_FUTURE_MODERNIST_RECOGNITIONS;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin/mvp" className="text-sm text-ink-muted hover:text-ink">
        ← MVP scoreboard
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Future Modernist recognition
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Monthly spotlight + annual Constellation cohort. Selection
        mechanism is metric-driven shortlist (top 5 OVR, non-provisional)
        + admin pick with editorial narrative. Member-vote phase opens
        when the voting cohort reaches ~15-25 Members.
      </p>

      <Card className="mt-8 border-[#D828A0]/40">
        <CardEyebrow>Metric suggestion</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          Top {SHORTLIST_SIZE} OVR · informational ({monthKey.label})
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          The MVP shortlist surfaces here as a data-driven suggestion.
          Selection is open to any active Member or Partner — admin
          editorial judgment overrides the metric when warranted.
          Recognizing a Partner is the platform&apos;s upgrade-path
          mechanic: their profile gets public-discovery visibility for
          the recognition window, which lets them use the cooperative
          as marketing infrastructure they can&apos;t access otherwise.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {shortlist.map((s, i) => {
            const user = MOCK_USERS.find((u) => u.id === s.userId);
            if (!user) return null;
            return (
              <li
                key={s.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--surface-border)] p-3"
              >
                <div>
                  <span className="text-ink-faint">{i + 1}. </span>
                  <Link
                    href={`/u/${user.handle}`}
                    className="font-medium hover:underline"
                  >
                    {publicName(user)}
                  </Link>
                  {user.discipline && (
                    <span className="ml-2 text-[11px] text-ink-muted">
                      {user.discipline}
                    </span>
                  )}
                </div>
                <span className="font-mono text-sm">OVR {s.ovr}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-6 border-[#5070F0]/40">
        <CardEyebrow>Select monthly winner · {monthKey.label}</CardEyebrow>
        {currentMonthWinner ? (
          <>
            <CardTitle className="mt-1 text-xl">
              Already selected — see below
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              {monthKey.label} winner is on file. Rescind first if you
              want to swap.
            </p>
          </>
        ) : (
          <SelectForm eligibleUsers={eligibleUsers} periodKind="month" />
        )}
      </Card>

      <Card className="mt-6 border-[#007048]/40">
        <CardEyebrow>Select annual Constellation · {yearKey.label}</CardEyebrow>
        {currentYearWinner ? (
          <>
            <CardTitle className="mt-1 text-xl">
              {yearKey.label} Constellation already named
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              See recent recognitions below.
            </p>
          </>
        ) : (
          <SelectForm eligibleUsers={eligibleUsers} periodKind="year" />
        )}
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Recent recognitions
        </h2>
        {recent.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No recognitions on file yet. Select the first one above.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {recent.map((r) => {
              const user = MOCK_USERS.find((u) => u.id === r.userId);
              if (!user) return null;
              return (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <CardEyebrow>
                        {r.periodKind === "month"
                          ? `Future Modernist of ${r.periodLabel}`
                          : `Constellation · ${r.periodLabel}`}
                      </CardEyebrow>
                      <CardTitle className="mt-1 text-lg">
                        <Link
                          href={`/u/${user.handle}`}
                          className="hover:underline"
                        >
                          {publicName(user)}
                        </Link>
                      </CardTitle>
                    </div>
                    <span className="text-[11px] text-ink-faint">
                      Selected {new Date(r.selectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink">{r.narrative}</p>
                  <form action={rescindFutureModernist} className="mt-3">
                    <input type="hidden" name="recognitionId" value={r.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-brand-magenta underline hover:opacity-80"
                    >
                      Rescind
                    </button>
                  </form>
                </Card>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SelectForm({
  eligibleUsers,
  periodKind,
}: {
  eligibleUsers: typeof MOCK_USERS;
  periodKind: "month" | "year";
}) {
  const members = eligibleUsers
    .filter((u) => u.membershipTier === "member")
    .sort((a, b) =>
      publicName(a).localeCompare(publicName(b)),
    );
  const partners = eligibleUsers
    .filter((u) => u.membershipTier === "partner")
    .sort((a, b) =>
      publicName(a).localeCompare(publicName(b)),
    );

  return (
    <form action={selectFutureModernist} className="mt-3 space-y-3">
      <input type="hidden" name="periodKind" value={periodKind} />
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">
          Winner
        </span>
        <select
          name="userId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Pick a Member or Partner
          </option>
          <optgroup label="Members (equity, full co-brand allowed)">
            {members.map((u) => (
              <option key={u.id} value={u.id}>
                {publicName(u)}
                {u.discipline ? ` — ${u.discipline}` : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="Partners (recognition unlocks discovery window; no external co-brand)">
            {partners.map((u) => (
              <option key={u.id} value={u.id}>
                {publicName(u)}
                {u.discipline ? ` — ${u.discipline}` : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div
        className="rounded-lg p-3 text-xs"
        style={{ backgroundColor: "rgba(80, 112, 240, 0.08)" }}
      >
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "#5070F0" }}>
          Co-brand policy reminder
        </span>
        <p className="mt-1 text-ink">
          When recognizing a Partner, the narrative emphasizes their
          work and discipline within the cooperative. Do NOT promote
          their independent company name or external brand — co-brand
          is reserved for Members. Recognition is FM&apos;s seal on
          their work; the Partner&apos;s own profile becomes
          publicly-discoverable for the recognition window, and that&apos;s
          the value-add. They can route clients to the URL themselves.
        </p>
      </div>

      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">
          Editorial narrative (≥ 50 chars)
        </span>
        <textarea
          name="narrative"
          rows={4}
          required
          minLength={50}
          placeholder="Why this person, this period. Ships with the recognition — write the version you'd want surfaced publicly. For Partners: stay focused on the work; no external-company promotion."
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        className="rounded-full px-5 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: periodKind === "year" ? "#007048" : "#D828A0" }}
      >
        Publish recognition
      </button>
    </form>
  );
}
