/**
 * Revenue split engine settlement page (Phase 1.6).
 *
 * Three pools, mirroring the spreadsheet's settled-engagements model:
 *
 *   contributor (85%) ← seeded from attribution ledger entries with role
 *                       `delivery_lead` / `contributor`. Weights normalized
 *                       to 100% of the contributor pool. Admin can override.
 *
 *   admin (12% of revenue, = 80% of commission) ← seeded from the contract's
 *                       `adminUserIds`. N admins supported (the spreadsheet
 *                       had a 5-admin Solana proposal as proof of need).
 *                       Even split by default; admin can adjust per row.
 *                       Add/remove admins inline via the AdminAllocator
 *                       client component.
 *
 *   reserve (3% of revenue, = 20% of commission) ← auto-routed 50/50 to
 *                       Treasury and the Liquidity Pool. The LP deposit is
 *                       the token-value mechanism (manufactured value, not
 *                       market-determined) — non-editable by design.
 *
 * Validation: contributor pool sums to 100%, admin pool sums to 100%.
 * Reserve is computed server-side from RESERVE_RECIPIENTS.
 *
 * On submit: write rows for all three pools, dispatch Stripe Connect
 * transfers per row (failure-isolated), mark contract `completed`.
 *
 * Sandbox: persists splits to MOCK_SPLITS in memory.
 * REPLACE WITH: Drizzle insert into `revenue_splits` + Stripe Connect
 * transfers + audit log entries on every decision.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_ATTRIBUTION } from "@/lib/mock-data/attribution";
import { MOCK_SPLITS, RESERVE_RECIPIENTS } from "@/lib/mock-data/splits";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  ATTRIBUTION_ROLE_LABELS,
  PAYOUT_STATUS_LABELS,
  adminName,
  rolePool,
  type PayoutStatus,
  type RevenueSplit,
  type SplitPool,
} from "@/lib/types";
import { dispatchTransfer } from "@/lib/payouts-stub";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { AdminAllocator } from "@/components/AdminAllocator";

const PAYOUT_COLOR: Record<PayoutStatus, string> = {
  pending: "#5070F0",
  queued: "#5070F0",
  sent: "#007048",
  failed: "#E53E3E",
};

// Pool ratios. Held here so we can crank them when we scale without
// hunting through the codebase.
const CONTRIBUTOR_POOL_PCT = 0.85;
const COMMISSION_PCT = 0.15;
const ADMIN_OF_COMMISSION_PCT = 0.80; // 80% of the 15% commission → admins
const RESERVE_OF_COMMISSION_PCT = 0.20; // 20% of the 15% commission → reserve

async function settleContract(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");

  const contractId = String(formData.get("contractId") ?? "");
  const project = MOCK_PROJECTS.find((p) => p.id === contractId);
  if (!project || !project.collectedRevenue) {
    throw new Error("Contract not eligible — no collected revenue.");
  }
  if (MOCK_SPLITS.some((s) => s.contractId === contractId)) {
    throw new Error("Contract already settled.");
  }

  const collected = Number(project.collectedRevenue);
  const contributorPool = collected * CONTRIBUTOR_POOL_PCT;
  const commission = collected * COMMISSION_PCT;
  const adminPool = commission * ADMIN_OF_COMMISSION_PCT;
  const reservePool = commission * RESERVE_OF_COMMISSION_PCT;

  // Contributor rows.
  const contribIds = formData.getAll("contribId").map(String);
  const contribPcts = formData.getAll("contribPct").map((v) => Number(v));
  const contribRows = contribIds
    .map((id, i) => ({ id, pct: contribPcts[i] ?? 0 }))
    .filter((r) => r.id && r.pct > 0);

  const contribTotal = contribRows.reduce((s, r) => s + r.pct, 0);
  if (Math.abs(contribTotal - 100) > 0.01) {
    throw new Error(
      `Contributor pool must sum to 100% — got ${contribTotal.toFixed(2)}%.`,
    );
  }

  // Admin rows.
  const adminIds = formData.getAll("adminId").map(String);
  const adminPcts = formData.getAll("adminPct").map((v) => Number(v));
  const adminRows = adminIds
    .map((id, i) => ({ id, pct: adminPcts[i] ?? 0 }))
    .filter((r) => r.id && r.pct > 0);

  if (adminRows.length === 0) {
    throw new Error("At least one admin required for the commission pool.");
  }
  const adminTotal = adminRows.reduce((s, r) => s + r.pct, 0);
  if (Math.abs(adminTotal - 100) > 0.01) {
    throw new Error(
      `Admin pool must sum to 100% — got ${adminTotal.toFixed(2)}%.`,
    );
  }

  const now = new Date().toISOString();

  // Persist the admin list back onto the project so the next settle
  // reflects who actually got paid.
  project.adminUserIds = adminRows.map((r) => r.id);

  // Contributor pool rows.
  for (const r of contribRows) {
    MOCK_SPLITS.push({
      id: `split_${Date.now()}_c_${r.id}`,
      contractId,
      recipientId: r.id,
      pool: "contributor",
      sharePct: r.pct.toFixed(2),
      amount: ((contributorPool * r.pct) / 100).toFixed(2),
      auto: false,
      decidedBy: admin.id,
      decidedAt: now,
      payoutStatus: "queued",
      payoutSentAt: null,
      stripeTransferId: null,
      notes: null,
    });
  }

  // Admin pool rows.
  for (const r of adminRows) {
    MOCK_SPLITS.push({
      id: `split_${Date.now()}_a_${r.id}`,
      contractId,
      recipientId: r.id,
      pool: "admin",
      sharePct: r.pct.toFixed(2),
      amount: ((adminPool * r.pct) / 100).toFixed(2),
      auto: false,
      decidedBy: admin.id,
      decidedAt: now,
      payoutStatus: "queued",
      payoutSentAt: null,
      stripeTransferId: null,
      notes: null,
    });
  }

  // Reserve pool rows — auto-routed, computed server-side, never editable.
  for (const r of RESERVE_RECIPIENTS) {
    MOCK_SPLITS.push({
      id: `split_${Date.now()}_r_${r.id}`,
      contractId,
      recipientId: r.id,
      pool: "reserve",
      sharePct: r.reserveSharePct.toFixed(2),
      amount: ((reservePool * r.reserveSharePct) / 100).toFixed(2),
      auto: true,
      decidedBy: null,
      decidedAt: null,
      payoutStatus: "queued",
      payoutSentAt: null,
      stripeTransferId: null,
      notes: `Auto-routed: ${r.reserveSharePct}% of reserve to ${r.label}.`,
    });
  }

  // Dispatch transfers. Per-row try/catch so one KYC failure doesn't
  // block the rest — each row tracks its own status for retry.
  const newRows = MOCK_SPLITS.filter((s) => s.contractId === contractId);
  for (const row of newRows) {
    try {
      await dispatchTransfer(row.id);
    } catch {
      // dispatchTransfer mutates the row's status on failure.
    }
  }

  project.status = "completed";
  project.updatedAt = now;

  revalidatePath(`/admin/contracts/${contractId}/settle`);
  revalidatePath("/admin/contracts");
  revalidatePath("/profile/attribution");
}

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) redirect("/dashboard");

  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project || project.kind !== "contract") notFound();

  const existingSplits = MOCK_SPLITS.filter((s) => s.contractId === id);
  if (existingSplits.length > 0) {
    return <SettledView project={project} splits={existingSplits} />;
  }

  if (!project.collectedRevenue) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/admin/contracts"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← Contract operations
        </Link>
        <Card className="mt-6">
          <CardEyebrow>Not ready to settle</CardEyebrow>
          <CardTitle className="mt-2">{project.title}</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Revenue hasn&apos;t landed for this contract yet. Once payment is
            confirmed (Stripe webhook fires `charge.succeeded` and the engine
            writes `collectedRevenue`), this page will scaffold the split
            allocator.
          </p>
        </Card>
      </div>
    );
  }

  const collected = Number(project.collectedRevenue);
  const contributorPool = collected * CONTRIBUTOR_POOL_PCT;
  const commission = collected * COMMISSION_PCT;
  const adminPool = commission * ADMIN_OF_COMMISSION_PCT;
  const reservePool = commission * RESERVE_OF_COMMISSION_PCT;

  // Aggregate attribution → contributor pool (delivery_lead + contributor
  // only). Weights summed across roles per user, normalized to 100%.
  const attributions = MOCK_ATTRIBUTION.filter((a) => a.contractId === id);
  const contribAttrs = attributions.filter(
    (a) => rolePool(a.role) === "contributor",
  );
  const contribWeights = new Map<string, number>();
  for (const e of contribAttrs) {
    contribWeights.set(
      e.userId,
      (contribWeights.get(e.userId) ?? 0) + e.weight,
    );
  }
  const totalContribWeight = Array.from(contribWeights.values()).reduce(
    (s, w) => s + w,
    0,
  );
  const contributorRows = Array.from(contribWeights.entries())
    .map(([userId, weight]) => ({
      userId,
      pct: totalContribWeight > 0 ? (weight / totalContribWeight) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  // Admin pool seeds: contract.adminUserIds is the source of truth.
  // Surface anyone with introducer/advisor attribution who isn't already
  // on the list as a "missing — should they be paid?" hint.
  const adminAttrUsers = new Set(
    attributions.filter((a) => rolePool(a.role) === "admin").map((a) => a.userId),
  );
  const missingAdmins = Array.from(adminAttrUsers).filter(
    (uid) => !project.adminUserIds.includes(uid),
  );

  // Candidates list for the AdminAllocator dropdown — anyone who could
  // plausibly be added (members + partners + admins).
  const adminCandidates = MOCK_USERS.filter(
    (u) => u.membershipTier !== "viewer" && u.membershipTier !== "prospect",
  ).map((u) => ({
    id: u.id,
    name: adminName(u),
    stripePayoutsEnabled: u.stripePayoutsEnabled,
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/admin/contracts"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Contract operations
      </Link>

      <header className="mt-3">
        <CardEyebrow>Revenue split engine</CardEyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Settle: {project.title}
        </h1>
        <p className="mt-2 text-ink-muted">
          85% to delivery contributors, 12% commission split evenly across
          the contract&apos;s admins, 3% auto-routed to Treasury + Liquidity
          Pool. Override any line if the deal was negotiated differently.
        </p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <PoolStat
          label="Collected revenue"
          value={`$${collected.toLocaleString()}`}
          color="#5070F0"
        />
        <PoolStat
          label="Contributor pool (85%)"
          value={`$${contributorPool.toLocaleString()}`}
          color="#D828A0"
        />
        <PoolStat
          label="Admin pool (12%)"
          value={`$${adminPool.toLocaleString()}`}
          color="#007048"
        />
        <PoolStat
          label="Reserve (3%)"
          value={`$${reservePool.toLocaleString()}`}
          color="#5070F0"
        />
      </div>

      {contributorRows.length === 0 && (
        <Card className="mt-6">
          <CardEyebrow>No contributor entries</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            You haven&apos;t logged delivery contributors for this contract
            yet. Settlement requires at least one ledger entry with role{" "}
            <em>delivery lead</em> or <em>contributor</em> — start with{" "}
            <Link
              href={`/admin/contracts/${id}/attribution`}
              className="underline hover:text-brand-magenta"
            >
              the attribution ledger
            </Link>
            .
          </p>
        </Card>
      )}

      {contributorRows.length > 0 && (
        <form action={settleContract} className="mt-8 space-y-6">
          <input type="hidden" name="contractId" value={project.id} />

          <Card>
            <CardTitle>
              Contributor pool — 85% (${contributorPool.toLocaleString()})
            </CardTitle>
            <p className="mt-1 text-xs text-ink-faint">
              Pre-filled from attribution weights (delivery_lead +
              contributor roles), normalized to 100%. Adjust any row.
            </p>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 text-left">Contributor</th>
                  <th className="py-2 text-left">Roles</th>
                  <th className="py-2 text-right">Share %</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {contributorRows.map((row) => {
                  const u = MOCK_USERS.find((u) => u.id === row.userId);
                  const roles = contribAttrs
                    .filter((a) => a.userId === row.userId)
                    .map((a) => ATTRIBUTION_ROLE_LABELS[a.role])
                    .join(", ");
                  return (
                    <tr
                      key={row.userId}
                      className="border-b border-[var(--surface-border)]"
                    >
                      <td className="py-3">
                        <input
                          type="hidden"
                          name="contribId"
                          value={row.userId}
                        />
                        <div className="font-medium">{adminName(u)}</div>
                        {u && !u.stripePayoutsEnabled && (
                          <p
                            className="mt-0.5 text-xs"
                            style={{ color: "#E53E3E" }}
                          >
                            Stripe payouts not enabled — transfer will fail.
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-xs text-ink-muted">{roles}</td>
                      <td className="py-3 text-right">
                        <input
                          name="contribPct"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue={row.pct.toFixed(2)}
                          className="w-24 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-right text-sm"
                        />
                        <span className="ml-1 text-ink-faint">%</span>
                      </td>
                      <td className="py-3 text-right text-ink-muted">
                        ≈ $
                        {(
                          (contributorPool * row.pct) /
                          100
                        ).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardTitle>
              Admin commission — 12% of revenue (${adminPool.toLocaleString()})
            </CardTitle>
            <p className="mt-1 text-xs text-ink-faint">
              Splits evenly across everyone on the admin list. Add or remove
              admins as needed; only adjust individual percentages if the
              shares were negotiated.
            </p>
            {missingAdmins.length > 0 && (
              <div
                className="mt-3 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs"
                style={{ backgroundColor: "rgba(80, 112, 240, 0.08)" }}
              >
                <strong>Heads up:</strong>{" "}
                {missingAdmins
                  .map(
                    (uid) =>
                      adminName(MOCK_USERS.find((u) => u.id === uid)) ?? uid,
                  )
                  .join(", ")}{" "}
                {missingAdmins.length === 1 ? "is" : "are"} on the attribution
                ledger as introducer/advisor but not in the admin list above.
                Add them if they&apos;re owed commission.
              </div>
            )}
            <AdminAllocator
              candidates={adminCandidates}
              initialAdminIds={project.adminUserIds}
              adminPool={adminPool}
              defaultEvenSplit
            />
          </Card>

          <Card>
            <CardTitle>
              Reserve — 3% of revenue (${reservePool.toLocaleString()})
            </CardTitle>
            <p className="mt-1 text-xs text-ink-faint">
              Auto-routed. The Liquidity Pool deposit manufactures token
              value over time — non-editable by design.
            </p>
            <div className="mt-4 space-y-2">
              {RESERVE_RECIPIENTS.map((r) => {
                const amount = (reservePool * r.reserveSharePct) / 100;
                return (
                  <div
                    key={r.id}
                    className="rounded-lg border-l-4 bg-[var(--surface-inset)] px-4 py-3"
                    style={{ borderLeftColor: "#5070F0" }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{r.label}</div>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {r.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {r.reserveSharePct}% (auto)
                        </div>
                        <div className="text-xs text-ink-faint">
                          ${amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <p className="text-sm text-ink-muted">
              On submit: writes split rows for all three pools, kicks off
              Stripe Connect transfers (one per recipient), marks the
              contract{" "}
              <code className="rounded bg-[var(--surface-inset)] px-1.5 py-0.5 text-xs">
                completed
              </code>
              . Failure on any single transfer doesn&apos;t block the others.
            </p>
            <button
              type="submit"
              className="mt-4 rounded-full px-6 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Settle and dispatch payouts
            </button>
          </Card>
        </form>
      )}
    </div>
  );
}

function PoolStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl border border-t-4 border-[var(--surface-border)] bg-[var(--surface-elevated)] p-5"
      style={{ borderTopColor: color }}
    >
      <div className="text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SettledView({
  project,
  splits,
}: {
  project: typeof MOCK_PROJECTS[number];
  splits: RevenueSplit[];
}) {
  const collected = Number(project.collectedRevenue ?? "0");
  const byPool = (pool: SplitPool) => splits.filter((s) => s.pool === pool);
  const sumPool = (pool: SplitPool) =>
    byPool(pool).reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/admin/contracts"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Contract operations
      </Link>

      <header className="mt-3">
        <CardEyebrow>Settled</CardEyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {project.title}
        </h1>
        <p className="mt-2 text-ink-muted">
          Revenue dispatched. Read-only audit view.
        </p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <PoolStat
          label="Collected"
          value={`$${collected.toLocaleString()}`}
          color="#5070F0"
        />
        <PoolStat
          label="Contributors paid"
          value={`$${sumPool("contributor").toLocaleString()}`}
          color="#D828A0"
        />
        <PoolStat
          label="Admins paid"
          value={`$${sumPool("admin").toLocaleString()}`}
          color="#007048"
        />
        <PoolStat
          label="Reserve routed"
          value={`$${sumPool("reserve").toLocaleString()}`}
          color="#5070F0"
        />
      </div>

      <Pool title="Contributor pool — 85%" rows={byPool("contributor")} />
      <Pool title="Admin commission — 12% of revenue" rows={byPool("admin")} />
      <Pool title="Reserve — 3% of revenue" rows={byPool("reserve")} />
    </div>
  );
}

function Pool({ title, rows }: { title: string; rows: RevenueSplit[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="mt-6">
      <CardTitle>{title}</CardTitle>
      <table className="mt-4 w-full text-sm">
        <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="py-2 text-left">Recipient</th>
            <th className="py-2 text-right">Share</th>
            <th className="py-2 text-right">Amount</th>
            <th className="py-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const recipientLabel = labelForRecipient(s.recipientId);
            return (
              <tr
                key={s.id}
                className="border-b border-[var(--surface-border)]"
              >
                <td className="py-3">
                  <div className="font-medium">{recipientLabel}</div>
                  {s.auto && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Auto-routed
                    </p>
                  )}
                  {s.notes && !s.auto && (
                    <p className="mt-0.5 text-xs text-ink-muted">{s.notes}</p>
                  )}
                  {s.stripeTransferId && (
                    <p className="mt-0.5 font-mono text-xs text-ink-faint">
                      {s.stripeTransferId}
                    </p>
                  )}
                </td>
                <td className="py-3 text-right">{s.sharePct}%</td>
                <td className="py-3 text-right font-medium">
                  ${Number(s.amount).toLocaleString()}
                </td>
                <td className="py-3 text-right">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${PAYOUT_COLOR[s.payoutStatus]}26`,
                      color: PAYOUT_COLOR[s.payoutStatus],
                    }}
                  >
                    {PAYOUT_STATUS_LABELS[s.payoutStatus]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function labelForRecipient(id: string): string {
  const user = MOCK_USERS.find((u) => u.id === id);
  if (user) return adminName(user);
  const reserve = RESERVE_RECIPIENTS.find((r) => r.id === id);
  if (reserve) return reserve.label;
  return id;
}
