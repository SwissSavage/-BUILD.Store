/**
 * Admin: annual canonization.
 *
 * End-of-year ritual where the cooperative snapshots every active
 * Member (and Partner who held recognition during the year) into a
 * permanent canonization row. Production mints each row as an ERC-721
 * with an ERC-6551 token-bound account so the card itself is the
 * Member's wallet for that year.
 *
 * Admin can run the canonization for any year (sandbox); production
 * gates on Dec 31 cron with admin sign-off + on-chain mint dispatch.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MOCK_CANONIZATIONS,
  canonizationsForYear,
} from "@/lib/mock-data/canonizations";
import {
  canonizeYear,
  setCanonizationCaption,
} from "@/lib/canonization-actions";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const TIER_LABELS: Record<string, string> = {
  standard: "Standard",
  probation: "Probation",
  good_standing: "Good standing",
  promotion_eligible: "Promotion eligible",
  future_modernist: "Future Modernist",
  champion: "Champion",
};

const TIER_ACCENT: Record<string, string> = {
  standard: "#666666",
  probation: "#666666",
  good_standing: "#007048",
  promotion_eligible: "#5070F0",
  future_modernist: "#D828A0",
  champion: "#D4AF37",
};

export default async function AdminCanonizationPage() {
  await requireAdmin();

  // Group canonizations by year for the listing.
  const years = Array.from(
    new Set(MOCK_CANONIZATIONS.map((c) => c.year)),
  ).sort((a, b) => b - a);

  const currentYear = new Date().getUTCFullYear();

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin/mvp" className="text-sm text-ink-muted hover:text-ink">
        ← MVP scoreboard
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Annual canonization
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Year-end ritual that immortalizes each active Member (and any
        Partner who held a recognition during the year) into a permanent
        canonization row. Production swap mints each row as an ERC-721
        with an ERC-6551 token-bound account. The card itself becomes
        the Member&apos;s wallet for the year — holds their $BUILD
        allocation, wrapped recognitions, and cooperative artifacts.
      </p>

      <div
        className="mt-4 rounded-lg border-l-4 p-3 text-sm"
        style={{
          borderColor: "#D828A0",
          backgroundColor: "rgba(216, 40, 160, 0.06)",
        }}
      >
        <span className="text-[11px] uppercase tracking-wider text-brand-magenta">
          Sandbox illustration · not cooperative canon
        </span>
        <p className="mt-1 text-ink">
          The 2025 entries below are seeded so the UI has cards to
          render during development. They are NOT cooperative canon.
          **The cooperative starts at zero** — production launches
          with the canonization store empty. First real canonization
          runs at the end of the first full calendar year of operation.
          Pre-production migration step: wipe the seed.
        </p>
      </div>

      <Card className="mt-8 border-[#D4AF37]/40">
        <CardEyebrow>Run canonization</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          Snapshot a year
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Idempotent — running again for the same year skips members
          who already have a row. Tier locks to the Member&apos;s
          rarity band at the moment of the run, so don&apos;t run mid-
          year unless you&apos;re intentionally freezing that state.
        </p>
        <form action={canonizeYear} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Year
            </span>
            <input
              type="number"
              name="year"
              defaultValue={currentYear}
              min={2020}
              max={2100}
              required
              className="mt-1 w-32 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-full px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#D4AF37" }}
          >
            Canonize year
          </button>
        </form>
        <p className="mt-3 text-[11px] text-ink-faint">
          Production: this dispatches the ERC-721 mint cycle and writes
          the resulting tokenId + ERC-6551 TBA address back to each row.
          Sandbox writes the row only.
        </p>
      </Card>

      {years.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-muted">
            No canonizations on file yet. Run the form above to snapshot
            a year.
          </p>
        </Card>
      ) : (
        years.map((y) => (
          <YearSection key={y} year={y} />
        ))
      )}
    </div>
  );
}

function YearSection({ year }: { year: number }) {
  const rows = canonizationsForYear(year).sort((a, b) => {
    // Sort by tier rank (champion at top) then ovr desc.
    const tierRank: Record<string, number> = {
      champion: 5,
      future_modernist: 4,
      promotion_eligible: 3,
      good_standing: 2,
      probation: 1,
      standard: 0,
    };
    if (tierRank[a.tier] !== tierRank[b.tier]) {
      return tierRank[b.tier] - tierRank[a.tier];
    }
    return (b.ovr ?? 0) - (a.ovr ?? 0);
  });

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">
          {year} canon
        </h2>
        <span className="text-xs text-ink-faint">
          {rows.length} card{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((c) => {
          const user = MOCK_USERS.find((u) => u.id === c.userId);
          if (!user) return null;
          return (
            <li
              key={c.id}
              className="rounded-lg border border-[var(--surface-border)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/u/${user.handle}`}
                    className="font-medium hover:underline"
                  >
                    {publicName(user)}
                  </Link>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                    style={{
                      backgroundColor: `${TIER_ACCENT[c.tier]}26`,
                      color: TIER_ACCENT[c.tier],
                    }}
                  >
                    {TIER_LABELS[c.tier] ?? c.tier}
                  </span>
                  {c.ovr !== null && (
                    <span className="text-[11px] font-mono text-ink-muted">
                      OVR {c.ovr}
                    </span>
                  )}
                  {c.recognitionIds.length > 0 && (
                    <span className="text-[11px] text-brand-magenta">
                      ★ {c.recognitionIds.length} recognition
                      {c.recognitionIds.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-ink-faint">
                  {c.tokenId
                    ? `Token #${c.tokenId}`
                    : "Mint pending"}
                </span>
              </div>
              {c.caption && (
                <p className="mt-2 text-sm text-ink">{c.caption}</p>
              )}
              <form
                action={setCanonizationCaption}
                className="mt-2 flex flex-wrap items-end gap-2 text-xs"
              >
                <input type="hidden" name="id" value={c.id} />
                <label className="flex-1">
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                    Caption (optional)
                  </span>
                  <input
                    type="text"
                    name="caption"
                    defaultValue={c.caption ?? ""}
                    placeholder="One-line story for the year"
                    className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
                >
                  Save caption
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
