/**
 * Admin: MVP Score scoreboard.
 *
 * Cooperative-wide view of every Member's published MVP Score snapshot,
 * ranked by OVR. Admin-only — full visibility (sub-rating preview,
 * compliance flags, period stamps).
 *
 * Champion's Court eligibility is computed at the surface (top 10% of
 * Members AND OVR ≥ 90). Eligible members get a flagged badge in the
 * table; recognition rail surfaces (Champion's Court, Constellation,
 * Future Modernist of [month]) are downstream and live elsewhere.
 *
 * Architecture lives in `future-modern.md` "MVP Score" section; types in
 * `lib/types.ts`; computation in `lib/mvp-score.ts`.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MOCK_MVP_SCORES,
  rankedSnapshots,
} from "@/lib/mock-data/mvp-scores";
import {
  championsCourtMembers,
  standingBand,
  standingLabel,
} from "@/lib/mvp-score";
import { MVP_STANDING_LABELS, publicName, type MvpStandingBand } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function AdminMvpPage() {
  await requireAdmin();

  const ranked = rankedSnapshots();
  const championIds = new Set(championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS));

  // Band distribution for the header summary.
  const bandCounts: Record<MvpStandingBand, number> = {
    champions_court_eligible: 0,
    future_modernist_pool: 0,
    promotion_eligible: 0,
    good_standing: 0,
    probation_review: 0,
    removal_accelerated: 0,
  };
  for (const s of ranked) bandCounts[standingBand(s.ovr)]++;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
            ← Admin home
          </Link>
          <h1 className="mt-3 font-display text-4xl font-semibold">
            MVP Score
          </h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Cooperative-wide standing across every Member. OVR rolls up from
            seven sub-ratings on a 12-month rolling window; published weekly
            so the surface doesn&apos;t jitter. See{" "}
            <code>future-modern.md</code> &quot;MVP Score&quot; for the
            full architecture.
          </p>
        </div>
        <div className="text-right">
          <CardEyebrow>Champion&apos;s Court</CardEyebrow>
          <div className="mt-1 font-display text-3xl font-semibold text-[#007048]">
            {championIds.size}
          </div>
          <div className="text-xs text-ink-faint">
            top 10% of Members AND OVR ≥ 90
          </div>
          <Link
            href="/admin/mvp/recognition"
            className="mt-2 inline-block text-[11px] text-brand-magenta hover:underline"
          >
            Future Modernist selection →
          </Link>
          <Link
            href="/admin/mvp/canonization"
            className="ml-3 mt-2 inline-block text-[11px] text-[#D4AF37] hover:underline"
          >
            Annual canonization →
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-2 md:grid-cols-6">
        {(Object.keys(bandCounts) as MvpStandingBand[]).map((b) => (
          <div
            key={b}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3"
          >
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">
              {MVP_STANDING_LABELS[b]}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {bandCounts[b]}
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-8">
        <CardEyebrow>Scoreboard</CardEyebrow>
        <CardTitle className="mt-1 text-xl">All published snapshots</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="py-2 pr-3 text-left">Rank</th>
                <th className="py-2 pr-3 text-left">Member</th>
                <th className="py-2 pr-3 text-left">Tier</th>
                <th className="py-2 pr-3 text-right">OVR</th>
                <th className="py-2 pr-3 text-left">Standing</th>
                <th className="py-2 pr-3 text-right">Penalties</th>
                <th className="py-2 pr-3 text-right">Published</th>
                <th className="py-2 pr-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => {
                const user = MOCK_USERS.find((u) => u.id === s.userId);
                if (!user) return null;
                const band = standingBand(s.ovr);
                const inCourt = championIds.has(s.userId);
                return (
                  <tr
                    key={s.userId}
                    className="border-b border-[var(--surface-border)] hover:bg-[var(--surface-inset)]"
                  >
                    <td className="py-2 pr-3 text-ink-faint">{i + 1}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{publicName(user)}</div>
                      {user.discipline && (
                        <div className="text-[11px] text-ink-muted">
                          {user.discipline}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        {user.membershipTier}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono font-medium">
                      {s.isProvisional ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        s.ovr
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {s.isProvisional ? (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor: "rgba(80, 112, 240, 0.12)",
                            color: "#5070F0",
                          }}
                        >
                          Provisional · Good standing
                        </span>
                      ) : (
                        <BandPill band={band} inCourt={inCourt} />
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {s.isProvisional ? (
                        <span className="text-ink-faint">N/A</span>
                      ) : s.activePenalties.length > 0 ? (
                        <span className="text-brand-magenta">
                          {s.activePenalties.length} active
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-[11px] text-ink-faint">
                      {new Date(s.publishedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Link
                        href={`/admin/mvp/${user.id}`}
                        className="text-[11px] text-brand-magenta hover:underline"
                      >
                        Manage ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-ink-faint">
          Sandbox snapshots are seeded for the threshold-ladder
          demonstration. Production swap rebuilds inputs daily from
          attribution / peer review / client rating / milestone-hit data,
          then publishes weekly.
        </p>
      </Card>
    </div>
  );
}

function BandPill({
  band,
  inCourt,
}: {
  band: MvpStandingBand;
  inCourt: boolean;
}) {
  const accent = BAND_ACCENT[band];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
      style={{ backgroundColor: accent.bg, color: accent.fg }}
    >
      {inCourt && <span aria-hidden>★</span>}
      {inCourt ? "Champion's Court" : standingLabel(thresholdMinFor(band))}
    </span>
  );
}

function thresholdMinFor(band: MvpStandingBand): number {
  if (band === "champions_court_eligible") return 90;
  if (band === "future_modernist_pool") return 80;
  if (band === "promotion_eligible") return 75;
  if (band === "good_standing") return 70;
  if (band === "probation_review") return 65;
  return 0;
}

const BAND_ACCENT: Record<MvpStandingBand, { bg: string; fg: string }> = {
  champions_court_eligible: { bg: "rgba(0, 112, 72, 0.12)", fg: "#007048" },
  future_modernist_pool: { bg: "rgba(80, 112, 240, 0.12)", fg: "#5070F0" },
  promotion_eligible: { bg: "rgba(80, 112, 240, 0.10)", fg: "#5070F0" },
  good_standing: { bg: "rgba(102, 102, 102, 0.12)", fg: "#666666" },
  probation_review: { bg: "rgba(216, 40, 160, 0.12)", fg: "#D828A0" },
  removal_accelerated: { bg: "rgba(216, 40, 160, 0.18)", fg: "#D828A0" },
};
