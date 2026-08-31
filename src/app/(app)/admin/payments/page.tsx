/**
 * Task #63 — /admin/payments — payout rail operations console.
 *
 * Two jobs on one page:
 *
 *   1. RAIL HEALTH. Which rails can actually move money right now,
 *      and which env vars each is missing. Mirrors /admin/compliance's
 *      posture of showing the real state rather than a green badge.
 *
 *   2. ASSISTED-RAIL QUEUE. Zelle and check payouts sit in
 *      `awaiting_manual` until a human sends them from Mercury and
 *      records the reference. This is where that happens. Without
 *      this surface those payouts would silently never go out.
 *
 * The queue reads revenue_splits. It read a fixture array until
 * 2026-08-30, so the manual-send queue showed the seed cooperative's
 * payouts and never a real one.
 *
 * Historical note: the settlement engine
 * hasn't been swapped to Drizzle yet (production-swap-checklist §2,
 * Tolgay). When it is, swap the filter for a db.select on
 * revenue_splits where payout_status = 'queued' and the method's rail
 * is assisted. Nothing else on this page changes.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import {
  PAYOUT_RAIL_LABELS,
  RAIL_DISPATCH_MODE,
  paymentsHealth,
  railIsAutomated,
  type RailHealth,
} from "@/lib/payments";
import { confirmManualPayout } from "@/lib/payout-method-actions";
import { getPendingSplits, safely } from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const STATUS_COLOR: Record<RailHealth["status"], string> = {
  ok: "#007048",
  degraded: "#8A5A00",
  unhealthy: "#E53E3E",
  not_configured: "#6B7280",
};

const STATUS_LABEL: Record<RailHealth["status"], string> = {
  ok: "Ready",
  degraded: "Partly wired",
  unhealthy: "Broken",
  not_configured: "Not set up",
};

function RailCard({ rail }: { rail: RailHealth }) {
  const missing = Object.entries(rail.envSummary).filter(([, present]) => !present);

  return (
    <div className="rounded-xl border border-[var(--surface-border)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{PAYOUT_RAIL_LABELS[rail.rail]}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {railIsAutomated(rail.rail)
              ? "Dispatches automatically"
              : "Requires a human to send"}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: `${STATUS_COLOR[rail.status]}18`,
            color: STATUS_COLOR[rail.status],
          }}
        >
          {STATUS_LABEL[rail.status]}
        </span>
      </div>

      <p className="mt-3 text-sm text-ink-muted">{rail.detail}</p>

      {missing.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium">Missing environment variables</p>
          <ul className="mt-1 space-y-0.5">
            {missing.map(([key]) => (
              <li key={key} className="font-mono text-xs text-ink-muted">
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function AdminPaymentsPage() {
  await requireAdmin();

  const rails = await paymentsHealth();
  const anyAutomated = rails.some(
    (r) => railIsAutomated(r.rail) && r.status === "ok",
  );

  // Assisted-rail queue. Reads splits that are queued but whose
  // dispatch can't happen without a human. See file header for the
  // Drizzle swap note.
  // The status filter is in the query — the splits table grows with
  // every settlement and this page only ever wants the undispatched
  // tail of it.
  const [pending, { users: roster }] = await Promise.all([
    safely(() => getPendingSplits(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const awaitingManual = pending.slice(0, 25);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin
      </Link>

      <header className="mt-3">
        <h1 className="font-display text-4xl font-semibold">Payments</h1>
        <p className="mt-2 text-ink-muted">
          Outbound payout rails and the manual-send queue.
        </p>
      </header>

      {!anyAutomated && (
        <div
          className="mt-6 rounded-xl px-4 py-3 text-sm"
          style={{ background: "#FDF0D5", color: "#8A5A00" }}
        >
          <strong>No automated rail is live.</strong> Every contributor payout
          will land in the manual queue below until Stripe, Plaid, or the
          crypto treasury is configured. That works, but it does not scale
          past a handful of contributors.
        </div>
      )}

      <Card className="mt-6">
        <CardEyebrow>Rail status</CardEyebrow>
        <CardTitle className="mt-2">
          What can actually move money right now
        </CardTitle>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rails.map((rail) => (
            <RailCard key={rail.rail} rail={rail} />
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          PayPal and Venmo are excluded by cooperative policy. Venmo has no
          payout path independent of PayPal, so neither is available.
        </p>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Manual send queue</CardEyebrow>
        <CardTitle className="mt-2">
          Payouts waiting on a human to send them
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Send each of these from Mercury, then record the confirmation
          number here. Nothing marks a contributor paid until you do.
        </p>

        {awaitingManual.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Nothing waiting. Every queued payout has been dispatched or
            confirmed.
          </p>
        ) : (
          <ul className="mt-4">
            {awaitingManual.map((split) => {
              const recipient = roster.find(
                (u) => u.id === split.recipientId,
              );
              return (
                <li
                  key={split.id}
                  className="flex flex-col gap-3 border-t border-[var(--surface-border)] py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {recipient?.firstName ?? split.recipientId} · $
                      {Number(split.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      Split {split.id} ·{" "}
                      {RAIL_DISPATCH_MODE.zelle === "assisted"
                        ? "assisted rail"
                        : ""}
                    </p>
                  </div>

                  <form
                    action={confirmManualPayout}
                    className="flex shrink-0 items-center gap-2"
                  >
                    <input type="hidden" name="splitId" value={split.id} />
                    <input
                      name="reference"
                      type="text"
                      required
                      placeholder="Confirmation #"
                      className="w-40 rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--brand-magenta)] px-3 py-1.5 text-sm font-medium text-white"
                    >
                      Mark sent
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
