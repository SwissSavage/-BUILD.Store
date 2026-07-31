/**
 * /admin/pools — structural pool balances + inflow history.
 *
 * Reads directly from the revenue-split ledger. No stored balances,
 * no separate pool table — the RevenueSplit rows ARE the ledger,
 * pools are just filtered aggregations over them.
 *
 * Sections:
 *   1. Treasury + LP + admin-pool + contributor-pool lifetime totals
 *      (headline balances the coop cares about).
 *   2. Treasury inflow history — every row that landed in the
 *      house_treasury sentinel, freshest first.
 *   3. LP inflow history — same shape for house_liquidity_pool.
 *   4. Per-admin earnings breakdown from the admin pool.
 *
 * Gated to admin.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  adminEarningsByUser,
  adminPoolLifetimeTotal,
  contributorPoolLifetimeTotal,
  inflowHistory,
  liquidityPoolBalance,
  treasuryBalance,
} from "@/lib/pool-balances";
import {
  HOUSE_LP_ID,
  HOUSE_TREASURY_ID,
} from "@/lib/settlement-splits";
import {
  REVENUE_SPLIT_SOURCE_KIND_LABELS,
  publicName,
} from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function AdminPoolsPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/pools");

  const treasury = treasuryBalance();
  const lp = liquidityPoolBalance();
  const adminPool = adminPoolLifetimeTotal();
  const contribPool = contributorPoolLifetimeTotal();

  const treasuryInflows = inflowHistory(HOUSE_TREASURY_ID);
  const lpInflows = inflowHistory(HOUSE_LP_ID);
  const adminByUser = adminEarningsByUser();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Structural pools</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Pool balances
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Treasury and Liquidity Pool balances derive from the
            revenue-split ledger — every contract settlement, order
            settlement, bonus release, and donation writes rows that
            aggregate here. Numbers reflect lifetime inflows minus
            nothing (pools accumulate; distribution downstream of
            this surface).
          </p>
        </div>
        <Link
          href="/admin/audit-log?resource=project"
          className="text-xs text-brand-magenta hover:underline"
        >
          Settlement audit trail →
        </Link>
      </div>

      {/* Headline balances */}
      <section className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BalanceCard
            label="Treasury"
            value={treasury}
            note="Long-horizon runway"
          />
          <BalanceCard
            label="Liquidity Pool"
            value={lp}
            note="Manufactures $BUILD value"
          />
          <BalanceCard
            label="Admin pool (lifetime)"
            value={adminPool}
            note="Distributed across admins"
            muted
          />
          <BalanceCard
            label="Contributor pool (lifetime)"
            value={contribPool}
            note="Paid to talent"
            muted
          />
        </div>
      </section>

      {/* Treasury inflow history */}
      <PoolHistorySection
        title="Treasury inflows"
        inflows={treasuryInflows}
      />

      {/* LP inflow history */}
      <PoolHistorySection title="LP inflows" inflows={lpInflows} />

      {/* Per-admin admin-pool breakdown */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Admin pool — per-admin lifetime
        </h2>
        {adminByUser.size === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No admin-pool distributions on record yet.
            </p>
          </Card>
        ) : (
          <Card className="mt-4">
            <ul className="divide-y divide-[var(--surface-border)]">
              {Array.from(adminByUser.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([userId, total]) => {
                  const user = MOCK_USERS.find((u) => u.id === userId);
                  return (
                    <li
                      key={userId}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex items-center gap-3">
                        {user && <Avatar user={user} size="sm" />}
                        <div>
                          <p className="text-sm font-medium">
                            {user ? publicName(user) : userId}
                          </p>
                          <p className="text-[11px] text-ink-faint">
                            {user?.membershipTier ?? "unknown"}
                          </p>
                        </div>
                      </div>
                      <p className="font-display text-lg font-semibold">
                        {USD_FMT.format(total)}
                      </p>
                    </li>
                  );
                })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  note,
  muted,
}: {
  label: string;
  value: number;
  note: string;
  muted?: boolean;
}) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-semibold ${
          muted ? "text-ink-faint" : "text-ink"
        }`}
      >
        {USD_FMT.format(value)}
      </p>
      <p className="mt-1 text-[11px] text-ink-faint">{note}</p>
    </Card>
  );
}

function PoolHistorySection({
  title,
  inflows,
}: {
  title: string;
  inflows: ReturnType<typeof inflowHistory>;
}) {
  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {inflows.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-ink-muted">
            No inflows on record yet.
          </p>
        </Card>
      ) : (
        <Card className="mt-4">
          <ul className="divide-y divide-[var(--surface-border)]">
            {inflows.map((flow) => (
              <li key={flow.splitId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {USD_FMT.format(flow.amount)}
                    </CardTitle>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {REVENUE_SPLIT_SOURCE_KIND_LABELS[flow.sourceKind]}
                      {" · "}
                      <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
                        {flow.sourceId}
                      </code>
                    </p>
                  </div>
                  {flow.at && (
                    <p
                      className="font-mono text-[10px] text-ink-faint"
                      title={flow.at}
                    >
                      {flow.at.slice(0, 10)}
                    </p>
                  )}
                </div>
                {flow.notes && (
                  <p className="mt-1 text-[11px] italic text-ink-muted">
                    {flow.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
