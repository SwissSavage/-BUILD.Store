import { Button } from "@/components/Button";
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
 * Splits persist to Postgres via settlement-splits.ts, which wraps
 * the whole distribution in one transaction.
 * REPLACE WITH: Drizzle insert into `revenue_splits` + Stripe Connect
 * transfers + audit log entries on every decision.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, revenueSplits } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  attributionReader,
  getLivePeerReviews,
  safely,
} from "@/lib/readers";
import { RESERVE_RECIPIENTS } from "@/lib/mock-data/splits";
import {
  ADMIN_PCT,
  LP_PCT,
  TREASURY_PCT,
  writeStandardSettlementSplits,
} from "@/lib/settlement-splits";
import { hasValidPayoutDocument } from "@/lib/payout-gate";
import { PayoutMethodPicker } from "@/components/PayoutMethodPicker";
import { issueBuildFromSettlement } from "@/lib/voucher-issuance";
import { issueRemittancesForSettlement } from "@/lib/remittance";
import { getAllUsers } from "@/lib/readers/users";
import {
  ATTRIBUTION_ROLE_LABELS,
  PAYOUT_STATUS_LABELS,
  adminName,
  rolePool,
  type PayoutStatus,
  type Project,
  type RevenueSplit,
  type SplitPool,
  type User,
  type PeerReview,
} from "@/lib/types";
import { dispatchTransfer } from "@/lib/payouts-stub";
import { customerFeedback as customerFeedbackTable } from "@/db/schema";
import { customerFeedbackReader } from "@/lib/readers";
import { poolForProject } from "@/lib/readers/reserve-pool";
import {
  reconcileBonusMargin,
  reviewGate,
  type RatingSignals,
} from "@/lib/bonus-reconciliation";
import { HALF_STEPS, formatStars, isHalfStep } from "@/lib/ratings";
import {
  executeBonusDecision,
  setPmEngagementRating,
} from "@/lib/bonus-release-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { AdminAllocator } from "@/components/AdminAllocator";

const PAYOUT_COLOR: Record<PayoutStatus, string> = {
  pending: "#5070F0",
  queued: "#5070F0",
  // Terminal for house pools; no transfer exists to succeed or fail.
  allocated: "#8A8A8A",
  // A person on a record-mode rail: a human sends it. See #113.
  awaiting_manual: "#B8860B",
  sent: "#007048",
  failed: "#E53E3E",
};

// Contributor pool ratio kept locally for the per-contributor amount
// derivation from the form's percentage inputs. The full split
// ratios live in `settlement-splits.ts` (single source of truth).
const CONTRIBUTOR_POOL_PCT = 0.85;

async function settleContract(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");

  const contractId = String(formData.get("contractId") ?? "");
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, contractId))
    .limit(1);
  if (!project || !project.collectedRevenue) {
    throw new Error("Contract not eligible — no collected revenue.");
  }
  const existingSplitCheck = await db
    .select({ id: revenueSplits.id })
    .from(revenueSplits)
    .where(eq(revenueSplits.contractId, contractId))
    .limit(1);
  if (existingSplitCheck.length > 0) {
    throw new Error("Contract already settled.");
  }
  if (!(await hasValidPayoutDocument(contractId, "contract_settlement"))) {
    throw new Error(
      "Settlement refused: no received external invoice or retroactive receipt on this contract. Generate + collect an external invoice (or attach a retroactive receipt) before settling.",
    );
  }

  const collected = Number(project.collectedRevenue);

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

  // Which rail each participant is paid on, chosen per person rather
  // than read off their profile. See #113: payout_methods is a
  // registry members do not maintain, and a registry nobody fills in
  // cannot decide where money goes. A missing or unknown value falls
  // to record mode, so the split lands awaiting_manual rather than
  // being dispatched on a guess.
  const payoutMethodByUserId: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("payoutMethod:")) continue;
    const userId = key.slice("payoutMethod:".length);
    const methodId = String(value).trim();
    if (userId && methodId) payoutMethodByUserId[userId] = methodId;
  }

  const now = new Date().toISOString();

  // Persist the admin list back onto the project so the next settle
  // reflects who actually got paid.
  project.adminUserIds = adminRows.map((r) => r.id);

  // Compute contributor per-user amounts from percentages so the
  // shared settlement engine can validate the sums.
  const contributorPool = collected * CONTRIBUTOR_POOL_PCT;
  const contribAmounts = contribRows.map((r) =>
    ((contributorPool * r.pct) / 100).toFixed(2),
  );

  // Delegate to the shared settlement engine — handles pool math,
  // reserve routing to Treasury/LP, and audit-log emission.
  await writeStandardSettlementSplits({
    gross: collected,
    sourceKind: "contract_settlement",
    sourceId: contractId,
    contractId,
    contributors: {
      userIds: contribRows.map((r) => r.id),
      amounts: contribAmounts,
    },
    admins: {
      userIds: adminRows.map((r) => r.id),
      percentages: adminRows.map((r) => r.pct),
    },
    actorUserId: admin.id,
    payoutMethodByUserId,
    noteContext: `Contract settlement — ${project.title}`,
  });

  // $BUILD cascade — canonical 6.087× network fees formula with
  // 80/16/2/2 split. Fires alongside the cash split so voucher
  // accounting stays in lockstep.
  try {
    await issueBuildFromSettlement({
      gross: collected,
      cashSourceKind: "contract_settlement",
      sourceId: contractId,
      contributors: {
        userIds: contribRows.map((r) => r.id),
        amounts: contribAmounts,
      },
      admins: { userIds: adminRows.map((r) => r.id) },
      actorUserId: admin.id,
      noteContext: `$BUILD generation — ${project.title} settlement`,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[contract-settle] issueBuildFromSettlement failed for ${contractId}:`,
      err,
    );
  }

  // The statement, issued rather than waited on. Reads the splits and
  // vouchers just written rather than recomputing them, so it cannot
  // hold a second opinion about the same money. Best-effort for the
  // same reason the cascade above is: settlement has already happened,
  // and a missing document must not unwind a payment.
  try {
    await issueRemittancesForSettlement({
      contractId,
      contractTitle: project.title,
      issuedByUserId: admin.id,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[contract-settle] issueRemittancesForSettlement failed for ${contractId}:`,
      err,
    );
  }

  // Dispatch transfers. Per-row try/catch so one KYC failure doesn't
  // block the rest — each row tracks its own status for retry.
  const newRows = await db
    .select()
    .from(revenueSplits)
    .where(eq(revenueSplits.contractId, contractId));
  for (const row of newRows) {
    try {
      await dispatchTransfer(row.id);
    } catch {
      // dispatchTransfer mutates the row's status on failure.
    }
  }

  await db
    .update(projects)
    .set({ status: "completed", updatedAt: now })
    .where(eq(projects.id, contractId));

  revalidatePath(`/admin/contracts/${contractId}/settle`);
  revalidatePath("/admin/contracts");
  revalidatePath("/profile/attribution");
}

export const dynamic = "force-dynamic";

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) redirect("/dashboard");

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!project || project.kind !== "contract") notFound();

  const existingSplits = await db
    .select()
    .from(revenueSplits)
    .where(eq(revenueSplits.contractId, id));
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
  const adminPool = collected * ADMIN_PCT;
  const reservePool = collected * (TREASURY_PCT + LP_PCT);

  // Aggregate attribution → contributor pool (delivery_lead + contributor
  // only). Weights summed across roles per user, normalized to 100%.
  // Reader swap 2026-08-29: attribution, roster, and peer reviews all
  // read seed data. This page computes who gets paid what, so it was
  // computing splits from a fictional contributor sheet.
  const [allAttribution, { users: roster }, allPeerReviews] =
    await Promise.all([
      safely(() => attributionReader.all(), []),
      safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
      // Live reviews only. A voided review must not show up in a
      // settlement sheet that decides what people are paid.
      safely(() => getLivePeerReviews(), []),
    ]);
  const userById = new Map(roster.map((u) => [u.id, u]));
  const labelForRecipient = makeLabelForRecipient(userById);

  const attributions = allAttribution.filter((a) => a.contractId === id);
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
  const adminCandidates = roster.filter(
    (u) => u.membershipTier !== "viewer",
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
          85% to delivery contributors, 12% executive share split evenly
          across the contract&apos;s executive list, 3% auto-routed to
          Treasury + Liquidity Pool. Override any line if the deal was
          negotiated differently.
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
          label="Executive share (12%)"
          value={`$${adminPool.toLocaleString()}`}
          color="#007048"
        />
        <PoolStat
          label="Reserve (3%)"
          value={`$${reservePool.toLocaleString()}`}
          color="#5070F0"
        />
      </div>

      <BonusReleasePanel
        project={project as unknown as Project}
        allPeerReviews={allPeerReviews}
      />

      {contributorRows.length === 0 && (
        <Card className="mt-6">
          <CardEyebrow>No contributor entries</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            You haven&apos;t logged delivery contributors for this contract
            yet. Settlement requires at least one ledger entry with role{" "}
            <em>delivery lead</em> or <em>contributor</em> — start with{" "}
            <Link
              href={`/admin/contracts/${id}/attribution`}
              className="underline hover:text-brand-magentaText"
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
                  const u = userById.get(row.userId);
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
                        {/* The Stripe warning that used to live here was
                            wrong for everyone it was shown to. Nobody is
                            paid through Connect unless they opted in, so
                            "transfer will fail" described a transfer
                            nobody intended to make. The method picker
                            below replaces it: pick the rail, and the
                            split lands awaiting_manual instead of
                            failed. See #113. */}
                        <PayoutMethodPicker userId={row.userId} />
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
              Executive share — 12% of revenue (${adminPool.toLocaleString()})
            </CardTitle>
            <p className="mt-1 text-xs text-ink-faint">
              Splits evenly across everyone on the executive list. Add or remove
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
                      adminName(userById.get(uid)) ?? uid,
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
            <Button
              type="submit"
              className="fm-btn-primary mt-4 rounded-full px-6 py-2.5 text-sm font-medium"
            >
              Settle and dispatch payouts
            </Button>
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

async function SettledView({
  project,
  splits,
}: {
  project: typeof projects.$inferSelect;
  splits: RevenueSplit[];
}) {
  // Loads its own roster: this view returns early, before the main
  // page body does its loading, so it cannot share that fetch.
  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });
  const labelForRecipient = makeLabelForRecipient(
    new Map(roster.map((u) => [u.id, u])),
  );

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

      <Pool title="Contributor pool — 85%" rows={byPool("contributor")} labelForRecipient={labelForRecipient} />
      <Pool title="Executive share — 12% of revenue" rows={byPool("admin")} labelForRecipient={labelForRecipient} />
      <Pool title="Reserve — 3% of revenue" rows={byPool("reserve")} labelForRecipient={labelForRecipient} />
    </div>
  );
}

function Pool({
  title,
  rows,
  labelForRecipient,
}: {
  title: string;
  rows: RevenueSplit[];
  labelForRecipient: (id: string) => string;
}) {
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

/* ------------------------------------------------------------------ */
/*  Bonus-release panel                                                */
/*                                                                     */
/*  Renders only when the contract has comp structure set              */
/*  (talentBonusAmount). For legacy contracts (null), nothing shows —  */
/*  the standard split engine still runs above.                        */
/*                                                                     */
/*  Three states:                                                      */
/*    - bonusDecision === "pending"     → admin can act (capture PM    */
/*                                          rating, execute gate)      */
/*    - bonusDecision === "released"    → recorded decision, shown     */
/*                                          read-only                  */
/*    - bonusDecision === "reclaimed"   → recorded decision, shown     */
/*                                          read-only with pool credit */
/* ------------------------------------------------------------------ */

async function BonusReleasePanel({
  project,
  allPeerReviews,
}: {
  project: Project;
  allPeerReviews: PeerReview[];
}) {
  if (!project.talentBonusAmount) return null;
  const baseAmount = Number(project.talentBaseAmount ?? 0);
  const bonusAmount = Number(project.talentBonusAmount);
  // Every reading, not the first. Feedback is collected at each
  // milestone and can come from more than one contact at the client,
  // so taking [0] would let the earliest milestone decide the margin.
  const feedbackRows = await customerFeedbackReader.where(
    eq(customerFeedbackTable.contextId, project.id),
  );
  const peerReviews = allPeerReviews.filter(
    (r) => r.contextId === project.id,
  );
  // The three slots, each averaging within itself before carrying
  // 0.4 / 0.4 / 0.2. Absent slots renormalize away rather than
  // scoring as the floor — see bonus-reconciliation.
  const signals: RatingSignals = {
    client: feedbackRows.map((f) => f.overallStars).filter(isHalfStep),
    peer: peerReviews.map((r) => r.stars).filter(isHalfStep),
    pm: [project.pmEngagementRating].filter(isHalfStep),
  };
  const contractCents = Math.round(
    Number(project.collectedRevenue ?? project.budget ?? 0) * 100,
  );
  const recon = reconcileBonusMargin({
    contractValueCents: contractCents,
    baseRateCents: Math.round(baseAmount * 100),
    bonusMarginCents: Math.round(bonusAmount * 100),
    signals,
  });
  const gate = reviewGate({
    bonusMarginCents: Math.round(bonusAmount * 100),
    grandfatherOverride: project.bonusGateWaiver?.kind === "grandfather"
      ? {
          byUserId: project.bonusGateWaiver.byUserId,
          reason: project.bonusGateWaiver.reason,
        }
      : null,
  });
  const pool = await poolForProject(project.id);

  // Full margin earned. Not a verdict any more — most outcomes are
  // partial, and this only drives the colour of the panel.
  const fullyEarned = recon.earnedFraction >= 1;

  return (
    <Card className="mt-6 border-[#5070F0]/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardEyebrow>Bonus-release decision</CardEyebrow>
          <CardTitle className="mt-1 text-2xl">
            ${baseAmount.toLocaleString()} base + ${bonusAmount.toLocaleString()} ceiling
          </CardTitle>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider"
          style={{
            backgroundColor:
              project.bonusDecision === "released"
                ? "rgba(0, 112, 72, 0.12)"
                : project.bonusDecision === "reclaimed"
                  ? "rgba(216, 40, 160, 0.12)"
                  : "rgba(80, 112, 240, 0.12)",
            color:
              project.bonusDecision === "released"
                ? "#007048"
                : project.bonusDecision === "reclaimed"
                  ? "#D828A0"
                  : "#5070F0",
          }}
        >
          {project.bonusDecision === "released"
            ? "Released to talent"
            : project.bonusDecision === "reclaimed"
              ? "Reclaimed to recovery pool"
              : "Pending decision"}
        </span>
      </div>

      {/*
        ─────────────────────────────────────────────────────────
        THE LINK IS NOT A DECISION (2026-11-24)

        This used to be an "Issue link" button, pressed by the admin
        doing the settling — the same admin whose PM rating is captured
        further down this page. So the only route to the no-client-
        rating path was that person not pressing it, which moved the
        decision from the client to themselves.

        Dispatch is now unconditional on milestone completion and there
        is no control here to skip, defer or re-issue as a choice. What
        remains is a read-out: how many readings came back, and whether
        delivery broke on our side. A failed send is OUR problem to
        see, because a silent one puts us right back to missing client
        feedback that we caused.
        ─────────────────────────────────────────────────────────
      */}
      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Client questionnaire
        </p>
        {feedbackRows.length > 0 ? (
          <p className="mt-1 text-xs text-ink-muted">
            {feedbackRows.length} reading
            {feedbackRows.length === 1 ? "" : "s"} collected. Requests go
            out automatically as milestones complete; nobody decides
            whether to ask.
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">
            Nothing back yet. Requests go out automatically as milestones
            complete. If none has been sent, that is a delivery failure
            on our side and the full margin is earned rather than held —
            the contributor does not pay for us not asking.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs">
        {/*
          Each slot shows its own average and how many readings are
          behind it, because "4.5★ from 1" and "4.5★ from 6" are very
          different confidences in the same number.
        */}
        <GateInputStat
          label={`Client · 0.4 (${signals.client.length})`}
          value={
            signals.client.length > 0
              ? `${formatStars(signals.client.reduce((a, b) => a + b, 0) / signals.client.length)}★`
              : "Not collected"
          }
        />
        <GateInputStat
          label={`Peer · 0.4 (${signals.peer.length})`}
          value={
            signals.peer.length > 0
              ? `${formatStars(signals.peer.reduce((a, b) => a + b, 0) / signals.peer.length)}★`
              : "—"
          }
        />
        <GateInputStat
          label={`PM · 0.2 (${signals.pm.length})`}
          value={
            signals.pm.length > 0
              ? `${formatStars(signals.pm[0])}★`
              : "Not captured"
          }
        />
      </div>

      <div
        className="mt-4 rounded-lg p-3 text-sm"
        style={{
          backgroundColor: fullyEarned
            ? "rgba(0, 112, 72, 0.06)"
            : "rgba(216, 40, 160, 0.06)",
        }}
      >
        <span
          className="text-[11px] uppercase tracking-wider"
          style={{ color: fullyEarned ? "#007048" : "#D828A0" }}
        >
          Bonus Margin ·{" "}
          {recon.blend.value === null
            ? "no rating collected"
            : `blended ${formatStars(recon.blend.value)} of 5`}
        </span>
        <p className="mt-1 text-ink">{recon.explanation}</p>
        {recon.uncommittedCents > 0 && (
          <>
            <p className="mt-2 text-ink">
              ${(recon.earnedMarginCents / 100).toLocaleString()} of the
              ${bonusAmount.toLocaleString()} margin is earned.
              ${(recon.uncommittedCents / 100).toLocaleString()} is
              uncommitted, which buys{" "}
              ${(recon.buysLabourCents / 100).toLocaleString()} of
              replacement work once its own commission is carried.
            </p>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[11px] text-ink-muted">
              {recon.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </>
        )}
        {!gate.blocks && (
          <p className="mt-2 text-[11px] text-ink-faint">
            {gate.explanation}
          </p>
        )}
      </div>

      {project.bonusDecision === "pending" && (
        <>
          {/*
            PM rating capture. Weighted 0.2 in the blend, down from the
            0.6 the old composite gave it, because it is the one slot
            filled by a party to the outcome. Half-steps like every
            other rating since drizzle/0054.
          */}
          <form action={setPmEngagementRating} className="mt-5 flex flex-wrap items-end gap-2 text-xs">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                PM engagement rating · 0.2 of the blend
              </span>
              <select
                name="rating"
                defaultValue={project.pmEngagementRating ?? ""}
                required
                className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1"
              >
                <option value="" disabled>
                  Select…
                </option>
                {HALF_STEPS.map((n) => (
                  <option key={n} value={n}>
                    {formatStars(n)}★
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="submit"
              className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] hover:border-brand-magenta hover:text-brand-magentaText"
            >
              Capture PM rating
            </Button>
          </form>

          <form action={executeBonusDecision} className="mt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <Button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: fullyEarned ? "#007048" : "#D828A0" }}
            >
              {/*
                Says the amounts, not a verdict. "Release" and "reclaim"
                were the only two things the old gate could do; this
                pays what was earned and parks the rest, and an admin
                should see both numbers before pressing it.
              */}
              {recon.uncommittedCents > 0
                ? `Reconcile: pay $${(recon.earnedMarginCents / 100).toLocaleString()} earned, hold $${(recon.uncommittedCents / 100).toLocaleString()}`
                : `Reconcile: pay the full $${bonusAmount.toLocaleString()} margin`}
            </Button>
            <p className="mt-2 text-[11px] text-ink-faint">
              Decision is recorded against this contract. Client never sees
              the bonus gate; talent sees the conditioning + outcome on
              their wallet history once executed.
            </p>
          </form>
        </>
      )}

      {project.bonusDecision === "reclaimed" && pool && (
        <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-sm">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint">
            Engagement Recovery Pool
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-xl font-semibold">
              ${Number(pool.balanceUsd).toLocaleString()}
            </span>
            <span className="text-[11px] text-ink-faint">
              Drawable to fund corrective hires for this client. Residue
              at engagement close folds back to treasury.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function GateInputStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-semibold text-ink">
        {value}
      </div>
    </div>
  );
}

function makeLabelForRecipient(userById: Map<string, User>) {
  return (id: string): string => {
    const user = userById.get(id);
    if (user) return adminName(user);
    const reserve = RESERVE_RECIPIENTS.find((r) => r.id === id);
    if (reserve) return reserve.label;
    return id;
  };
}

