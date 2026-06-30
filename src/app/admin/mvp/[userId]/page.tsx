/**
 * Admin: per-member MVP Score detail + compliance penalty controls.
 *
 * Surfaces:
 *   - Full self-mode MvpCard (admin sees everything per locked policy).
 *   - All penalties on file (active + expired) with rescind action on
 *     each active row.
 *   - Apply-new-penalty form: -9 OVR for 90 days, reason >= 10 chars
 *     required.
 *   - Sub-rating breakdown table (input layer that feeds OVR).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MOCK_MVP_PENALTIES,
  mvpScoreForUser,
} from "@/lib/mock-data/mvp-scores";
import {
  applyCompliancePenalty,
  rescindCompliancePenalty,
} from "@/lib/mvp-score-actions";
import {
  MVP_SUB_RATING_LABELS,
  publicName,
  type MvpSubRating,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { MvpCard } from "@/components/MvpCard";

export default async function AdminMvpUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) notFound();
  const snapshot = mvpScoreForUser(userId);

  const penalties = MOCK_MVP_PENALTIES
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

  const now = new Date().toISOString();
  const activeCount = penalties.filter((p) => p.expiresAt > now).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin/mvp"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← MVP scoreboard
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        MVP detail · {publicName(user)}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Compliance-instrument administration surface. Penalties apply
        immediately and re-publish this user&apos;s snapshot — the
        rest of the platform sees the new OVR within the same request.
      </p>

      {snapshot && (
        <div className="mt-8">
          <MvpCard snapshot={snapshot} user={user} mode="self" />
        </div>
      )}

      {!snapshot && (
        <Card className="mt-8">
          <CardEyebrow>No snapshot</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            No MVP Score on file for this user. Sandbox seeds Members
            only; Partner-tier and below don&apos;t get a published
            snapshot. Production recompute would generate one once
            sub-rating inputs accrue.
          </p>
        </Card>
      )}

      <Card className="mt-6 border-[#D828A0]/40">
        <CardEyebrow>Apply compliance penalty</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          -9 OVR for 90 days, stacking
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Per locked mechanic (see <code>future-modern.md</code>{" "}
          &quot;MVP Score&quot;). Each penalty stacks with active
          penalties already on file; the OVR drop fires the moment the
          form submits. Reason is admin-only and recorded for arbitration
          / audit.
        </p>
        <form action={applyCompliancePenalty} className="mt-4 space-y-3">
          <input type="hidden" name="userId" value={user.id} />
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Reason (admin-only, ≥ 10 chars)
            </span>
            <textarea
              name="reason"
              rows={3}
              required
              minLength={10}
              placeholder="Cooperative-covenant violation: ..."
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-full px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            Apply -9 OVR penalty
          </button>
        </form>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Penalty history</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          {penalties.length} on file · {activeCount} active
        </CardTitle>
        {penalties.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No penalties on file. Clean compliance record.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {penalties.map((p) => {
              const isActive = p.expiresAt > now;
              return (
                <li
                  key={p.id}
                  className={`rounded-lg border p-3 ${
                    isActive
                      ? "border-[#D828A0]/40 bg-[rgba(216,40,160,0.04)]"
                      : "border-[var(--surface-border)] opacity-60"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span
                        className={`text-[10px] uppercase tracking-wider ${
                          isActive ? "text-brand-magenta" : "text-ink-faint"
                        }`}
                      >
                        {isActive ? "Active" : "Expired"}
                      </span>
                      <span className="ml-2 font-mono text-sm">
                        {p.ovrImpact} OVR
                      </span>
                    </div>
                    <span className="text-[11px] text-ink-faint">
                      {new Date(p.appliedAt).toLocaleDateString()} →{" "}
                      {new Date(p.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{p.reason}</p>
                  {isActive && (
                    <form action={rescindCompliancePenalty} className="mt-2">
                      <input type="hidden" name="penaltyId" value={p.id} />
                      <button
                        type="submit"
                        className="text-[11px] text-brand-magenta underline hover:opacity-80"
                      >
                        Rescind (admin override)
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {snapshot && (
        <Card className="mt-6">
          <CardEyebrow>Sub-ratings</CardEyebrow>
          <CardTitle className="mt-1 text-xl">Input layer</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Sub-rating values are computed daily from real attribution /
            peer review / client rating / milestone-hit data in
            production. Sandbox seeds these directly so the OVR pipeline
            has something to roll up. Editing these is a future-session
            scope item; for now the read-only view is the right view.
          </p>
          <table className="mt-4 w-full text-sm">
            <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="py-2 pr-3 text-left">Sub-rating</th>
                <th className="py-2 pr-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(MVP_SUB_RATING_LABELS) as MvpSubRating[]).map(
                (k) => (
                  <tr
                    key={k}
                    className="border-b border-[var(--surface-border)]"
                  >
                    <td className="py-2 pr-3">{MVP_SUB_RATING_LABELS[k]}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {snapshot.subRatings[k] ?? 0}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
