/**
 * Member's personal canon view.
 *
 * Three surfaces:
 *   1. In-progress current year — projected canon based on current
 *      standing. Locks at year-end.
 *   2. Past minted canon — the Member's collection across years, each
 *      rendered as a TradingCard. Per-card phygital request affordance.
 *   3. Recognition history — every Future Modernist / Constellation
 *      the Member has held.
 *
 * Auth-gated to Members (Partners don't get canon unless they were
 * recognized in the year — and even then they see their canon on
 * /u/[handle], not here).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { mvpScoreForUser, MOCK_MVP_SCORES } from "@/lib/mock-data/mvp-scores";
import { championsCourtMembers } from "@/lib/mvp-score";
import { canonizationsForUser } from "@/lib/mock-data/canonizations";
import { recognitionsForUser } from "@/lib/mock-data/future-modernist-recognitions";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { requestPhygitalCanonCard } from "@/lib/canon-phygital-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  TradingCard,
  deriveTradingCardTier,
  type TradingCardTier,
} from "@/components/TradingCard";

const TIER_LABELS: Record<TradingCardTier, string> = {
  standard: "Standard",
  probation: "Probation",
  good_standing: "Good standing",
  promotion_eligible: "Promotion eligible",
  future_modernist: "Future Modernist",
  champion: "Champion",
};

const TIER_ACCENT: Record<TradingCardTier, string> = {
  standard: "#666666",
  probation: "#666666",
  good_standing: "#007048",
  promotion_eligible: "#5070F0",
  future_modernist: "#D828A0",
  champion: "#D4AF37",
};

export default async function MemberCanonPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile/canon");

  if (user.membershipTier !== "member") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          Canon view is for Members
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          Annual canonization is a Member-tier rite. Partner-tier canon
          renders on <code>/u/[handle]</code> only when you held a
          recognition during a given year. Climb the ladder; promotion
          unlocks the personal canon view + the phygital marketplace
          path.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-block text-sm text-brand-magenta hover:underline"
        >
          ← Back to profile
        </Link>
      </div>
    );
  }

  const past = canonizationsForUser(user.id);
  const recognitions = recognitionsForUser(user.id);
  const snapshot = mvpScoreForUser(user.id);
  const courtIds = new Set(championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS));
  const currentYear = new Date().getUTCFullYear();
  const currentTier: TradingCardTier = deriveTradingCardTier({
    ovr: snapshot?.ovr ?? null,
    isProvisional: snapshot?.isProvisional ?? false,
    isInChampionsCourt: courtIds.has(user.id),
  });
  const hasCurrentYearCard = past.some((c) => c.year === currentYear);

  // Year-end date — fires the production canonization cycle.
  const yearEnd = new Date(`${currentYear}-12-31T23:59:59Z`);
  const today = new Date();
  const daysToCanon = Math.max(
    0,
    Math.ceil((yearEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profile"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Back to profile
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Your canon
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Year-end cards minted as permanent ERC-721 NFTs with ERC-6551
        token-bound accounts — the card itself becomes your wallet for
        the year (holds your $BUILD allocation, wrapped recognitions,
        cooperative artifacts). Phygital prints land as a marketplace
        product class (v1.1+).
      </p>

      {/* In-progress current year */}
      <Card className="mt-8 border-[#D4AF37]/40">
        <CardEyebrow>{currentYear} — in progress</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          {hasCurrentYearCard
            ? `${currentYear} canon already minted`
            : `Locks ${yearEnd.toLocaleDateString()} (${daysToCanon} day${daysToCanon === 1 ? "" : "s"} out)`}
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          {hasCurrentYearCard ? (
            <>
              See the {currentYear} card below. Year-end canonization
              already locked your tier for this year.
            </>
          ) : (
            <>
              Your projected tier based on current standing:{" "}
              <span style={{ color: TIER_ACCENT[currentTier] }}>
                {TIER_LABELS[currentTier]}
              </span>
              . This is what locks if year-end fires today. Climbing
              between now and December moves the tier.
            </>
          )}
        </p>
        {!hasCurrentYearCard && (
          <div className="mt-5 max-w-[280px]">
            <TradingCard user={user} tier={currentTier} aspectRatio="3/4">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-start justify-between text-white">
                  <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    {currentYear} · projected
                  </span>
                  {snapshot && !snapshot.isProvisional && (
                    <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-mono">
                      OVR {snapshot.ovr}
                    </span>
                  )}
                </div>
              </div>
            </TradingCard>
            <p className="mt-2 text-[11px] text-ink-faint">
              Preview only — the card locks at year-end with your
              actual standing.
            </p>
          </div>
        )}
      </Card>

      {/* Past minted canon */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Past canon
        </h2>
        {past.length === 0 ? (
          <Card className="mt-3">
            <p className="text-sm text-ink-muted">
              No prior canon on file. The cooperative starts at zero —
              the first time your card mints is the first year-end after
              you join.
            </p>
          </Card>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {past.map((c) => (
              <Card key={c.id}>
                <TradingCard
                  user={user}
                  tier={c.tier as TradingCardTier}
                  className="w-full"
                  aspectRatio="3/4"
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between text-white">
                      <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        {c.year}
                      </span>
                      {c.ovr !== null && (
                        <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-mono">
                          OVR {c.ovr}
                        </span>
                      )}
                    </div>
                  </div>
                </TradingCard>
                {c.caption && (
                  <p className="mt-2 text-[11px] text-ink">{c.caption}</p>
                )}
                <p className="mt-1 text-[10px] text-ink-faint">
                  {c.tokenId
                    ? `Token #${c.tokenId} · TBA ${c.tbaAddress?.slice(0, 8)}…`
                    : "Sandbox snapshot · mint cycle pending"}
                </p>
                <details className="mt-3 rounded-lg bg-[var(--surface)] p-2 text-xs">
                  <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-brand-magenta">
                    Request phygital print
                  </summary>
                  <p className="mt-2 text-[11px] text-ink-muted">
                    Production: routes to the print partner with NFC /
                    QR tied to your TBA. Sandbox stub fires a notification
                    to admins acknowledging the request.
                  </p>
                  <form
                    action={requestPhygitalCanonCard}
                    className="mt-2 space-y-2"
                  >
                    <input type="hidden" name="canonId" value={c.id} />
                    <textarea
                      name="shippingNote"
                      rows={2}
                      placeholder="Shipping notes (optional)"
                      className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                    />
                    <button
                      type="submit"
                      className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
                      style={{ backgroundColor: "#D4AF37" }}
                    >
                      Request phygital
                    </button>
                  </form>
                </details>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recognition history */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Recognition history
        </h2>
        {recognitions.length === 0 ? (
          <Card className="mt-3">
            <p className="text-sm text-ink-muted">
              No recognitions on file. Future Modernist of the Month +
              annual Constellation cohort awards show up here when
              admin selects you from the metric shortlist.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {recognitions.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardEyebrow>
                    {r.periodKind === "year"
                      ? `Constellation · ${r.periodLabel}`
                      : `Future Modernist of ${r.periodLabel}`}
                  </CardEyebrow>
                  <span className="text-[11px] text-ink-faint">
                    {new Date(r.selectedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink">{r.narrative}</p>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
