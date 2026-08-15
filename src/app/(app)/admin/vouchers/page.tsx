/**
 * /admin/vouchers — $BUILD voucher ledger + batch-swap surface.
 *
 * The single source of truth for the off-chain accounting mirror of
 * real $BUILD. Layout:
 *   1. Supply utilization header — how much of the 10M cap has been
 *      issued, pending swap, swapped, forfeited, and remaining.
 *   2. Issue-new-voucher form — admin picks user, amount, source
 *      type, optional TokenTransaction ref + notes. Supply-cap guard
 *      runs in the server action; the form does not pre-block the
 *      submission client-side because the cap is a live number.
 *   3. Batch-swap queue — every pending_swap row with a "Complete
 *      swap" affordance that takes a tx hash, plus a "Cancel queue"
 *      affordance for reverting back to unswapped.
 *   4. Full ledger — every row grouped by user, freshest issued
 *      first, with per-row actions appropriate to the swap status.
 *
 * Gated to admin. Every mutation writes to the audit log.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_BUILD_VOUCHERS } from "@/lib/mock-data/vouchers";
import { publicName } from "@/lib/types";
import type { BuildVoucher } from "@/lib/types";
import {
  BUILD_VOUCHER_SOURCE_TYPE_LABELS,
  BUILD_VOUCHER_SUPPLY_CAP,
  BUILD_VOUCHER_SWAP_STATUS_LABELS,
} from "@/lib/types";
import {
  cancelPendingSwap,
  completeVoucherSwap,
  forfeitVoucher,
  issueVoucher,
  markVoucherPendingSwap,
} from "@/lib/voucher-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

const NUMBER_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});

/**
 * Sum voucher amounts by swap status. Returns a plain number for
 * display; safe at the 10M cap because 10M * 1e8 = 1e15 <<
 * Number.MAX_SAFE_INTEGER.
 */
function sumByStatus(
  rows: BuildVoucher[],
  status: BuildVoucher["swapStatus"],
): number {
  return rows
    .filter((v) => v.swapStatus === status)
    .reduce((sum, v) => sum + Number(v.amount), 0);
}

/**
 * Pick the user roster the issuance form allows. Members +
 * Partners + Prospects — no Viewers (no earning relationship). No
 * suspended accounts.
 */
function issuanceCandidates() {
  return [...MOCK_USERS]
    .filter(
      (u) =>
        (u.membershipTier === "member" ||
          u.membershipTier === "partner") &&
        u.suspendedAt === null,
    )
    .sort((a, b) =>
      publicName(a).localeCompare(publicName(b), "en", { sensitivity: "base" }),
    );
}

/** Group vouchers by user, freshest issued first within each group. */
function groupByUser(rows: BuildVoucher[]): Map<string, BuildVoucher[]> {
  const byUser = new Map<string, BuildVoucher[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  for (const list of byUser.values()) {
    list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }
  return byUser;
}

export default async function AdminVouchersPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/vouchers");

  const rows = [...MOCK_BUILD_VOUCHERS];
  const unswappedTotal = sumByStatus(rows, "unswapped");
  const pendingTotal = sumByStatus(rows, "pending_swap");
  const swappedTotal = sumByStatus(rows, "swapped");
  const forfeitedTotal = sumByStatus(rows, "forfeited");
  const issuedAgainstCap = unswappedTotal + pendingTotal + swappedTotal;
  const remaining = BUILD_VOUCHER_SUPPLY_CAP - issuedAgainstCap;
  const utilizationPct = (issuedAgainstCap / BUILD_VOUCHER_SUPPLY_CAP) * 100;

  const pendingQueue = rows
    .filter((v) => v.swapStatus === "pending_swap")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  const grouped = groupByUser(rows);
  const candidates = issuanceCandidates();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · $BUILD vouchers</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Voucher ledger
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Off-chain accounting mirror of the real $BUILD token. Every
            row here represents a redeemable claim. Once the token is
            under a multisig contract (or a fresh spin-up if the
            dispute resolves that way), pending vouchers batch-swap
            1:1 into on-chain $BUILD.
          </p>
        </div>
        <Link
          href="/admin/audit-log?resource=build_voucher"
          className="text-xs text-brand-magenta hover:underline"
        >
          Voucher audit trail →
        </Link>
      </div>

      {/* Supply utilization */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Supply utilization
        </h2>
        <Card className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-muted">
                Cap
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {NUMBER_FMT.format(BUILD_VOUCHER_SUPPLY_CAP)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-ink-muted">
                Issued (against cap)
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {NUMBER_FMT.format(issuedAgainstCap)}{" "}
                <span className="text-sm font-normal text-ink-faint">
                  ({utilizationPct.toFixed(4)}%)
                </span>
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-[var(--surface-inset)]">
            <div
              className="h-2 rounded-full bg-brand-magenta"
              style={{ width: `${Math.min(utilizationPct, 100)}%` }}
            />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <StatCell label="Unswapped" value={unswappedTotal} accent="ink" />
            <StatCell label="Pending swap" value={pendingTotal} accent="ink" />
            <StatCell label="Swapped" value={swappedTotal} accent="ink" />
            <StatCell
              label="Forfeited (off cap)"
              value={forfeitedTotal}
              accent="muted"
            />
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            Remaining issuance headroom:{" "}
            <strong className="text-ink">
              {NUMBER_FMT.format(remaining)}
            </strong>
            . Forfeited vouchers do not count against the cap —
            reclaimed supply returns to headroom.
          </p>
        </Card>
      </section>

      {/* Issue new voucher */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Issue a voucher
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Supply cap enforced server-side at submission. Issuance
          that would push above 10M is refused with a headroom hint.
        </p>

        <form
          action={issueVoucher}
          className="mt-6 space-y-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="userId"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Recipient
              </label>
              <select
                id="userId"
                name="userId"
                required
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="">Pick a user</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {publicName(u)} · {u.membershipTier}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="sourceType"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Source type
              </label>
              <select
                id="sourceType"
                name="sourceType"
                required
                defaultValue="project_completion"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {(Object.keys(BUILD_VOUCHER_SOURCE_TYPE_LABELS) as Array<
                  keyof typeof BUILD_VOUCHER_SOURCE_TYPE_LABELS
                >).map((t) => (
                  <option key={t} value={t}>
                    {BUILD_VOUCHER_SOURCE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="amount"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Amount
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12500 or 12500.5"
                required
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                Up to 8 decimal places. Must be positive. Refused
                server-side if it would push above 10M cap.
              </p>
            </div>
            <div>
              <label
                htmlFor="sourceRefId"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Source ref id (optional)
              </label>
              <input
                id="sourceRefId"
                name="sourceRefId"
                type="text"
                placeholder="TokenTransaction id, if this mirrors one"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Why this issuance — bonus release, OG backfill, referral kick, etc."
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              Issue voucher
            </button>
          </div>
        </form>
      </section>

      {/* Batch-swap queue */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Batch-swap queue
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Vouchers marked pending. Complete a swap by pasting the
          on-chain tx hash from the batch settlement. Cancel to
          revert back to unswapped if a batch window closes
          unexecuted.
        </p>
        {pendingQueue.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No vouchers currently queued for swap.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingQueue.map((row) => {
              const user = MOCK_USERS.find((u) => u.id === row.userId);
              return (
                <li key={row.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {user && <Avatar user={user} size="sm" />}
                        <div>
                          <p className="font-medium text-sm">
                            {user ? publicName(user) : row.userId}
                          </p>
                          <p className="text-[11px] text-ink-faint">
                            {NUMBER_FMT.format(Number(row.amount))} · {" "}
                            {BUILD_VOUCHER_SOURCE_TYPE_LABELS[row.sourceType]}
                          </p>
                        </div>
                      </div>
                      <p
                        className="font-mono text-[10px] text-ink-faint"
                        title={row.updatedAt}
                      >
                        queued {row.updatedAt.slice(0, 10)}
                      </p>
                    </div>

                    <form
                      action={completeVoucherSwap}
                      className="mt-4 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <div className="flex-1 min-w-[220px]">
                        <label
                          htmlFor={`tx-${row.id}`}
                          className="block text-[11px] uppercase tracking-wider text-ink-muted"
                        >
                          Tx hash from batch settlement
                        </label>
                        <input
                          id={`tx-${row.id}`}
                          name="txHash"
                          type="text"
                          required
                          placeholder="0x..."
                          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-full bg-brand-magenta px-4 py-2 text-xs font-medium text-brand-white hover:bg-brand-magenta/90"
                      >
                        Complete swap
                      </button>
                    </form>

                    <form action={cancelPendingSwap} className="mt-2">
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="text-[11px] text-ink-faint hover:text-brand-magenta"
                      >
                        Cancel — revert to unswapped
                      </button>
                    </form>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Full ledger */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Full ledger
        </h2>
        {grouped.size === 0 ? (
          <Card className="mt-6">
            <p className="text-sm text-ink-muted">
              No vouchers issued yet. Author the first one above.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 space-y-4">
            {Array.from(grouped.entries()).map(([userId, userRows]) => {
              const user = MOCK_USERS.find((u) => u.id === userId);
              if (!user) return null;
              const active = userRows
                .filter((v) => v.swapStatus !== "forfeited")
                .reduce((sum, v) => sum + Number(v.amount), 0);
              return (
                <li key={userId}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={user} size="sm" />
                        <div>
                          <CardTitle className="text-lg">
                            {publicName(user)}
                          </CardTitle>
                          <p className="text-[11px] text-ink-faint">
                            {user.membershipTier} · {userRows.length} row
                            {userRows.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm">
                        Active claim:{" "}
                        <strong>{NUMBER_FMT.format(active)}</strong>
                      </p>
                    </div>

                    <ul className="mt-4 divide-y divide-[var(--surface-border)]">
                      {userRows.map((row) => (
                        <li key={row.id} className="py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                {NUMBER_FMT.format(Number(row.amount))}{" "}
                                <span className="text-ink-faint">
                                  ·{" "}
                                  {
                                    BUILD_VOUCHER_SOURCE_TYPE_LABELS[
                                      row.sourceType
                                    ]
                                  }
                                </span>
                              </p>
                              <p className="text-[11px] text-ink-faint">
                                <span
                                  title={row.issuedAt}
                                  className="uppercase tracking-wider"
                                >
                                  {
                                    BUILD_VOUCHER_SWAP_STATUS_LABELS[
                                      row.swapStatus
                                    ]
                                  }
                                </span>
                                {" · issued "}
                                {row.issuedAt.slice(0, 10)}
                              </p>
                            </div>
                            <VoucherRowActions row={row} />
                          </div>

                          {row.swappedToTxHash && (
                            <p className="mt-1 break-all text-[11px] text-ink-faint">
                              Tx:{" "}
                              <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
                                {row.swappedToTxHash}
                              </code>
                            </p>
                          )}
                          {row.sourceRefId && (
                            <p className="mt-1 text-[11px] text-ink-faint">
                              Ref:{" "}
                              <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
                                {row.sourceRefId}
                              </code>
                            </p>
                          )}
                          {row.notes && (
                            <p className="mt-1 text-[11px] italic text-ink-muted">
                              {row.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
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

/**
 * Per-row action strip. Renders only actions valid for the current
 * swap status — the server actions enforce the transition rules
 * too, but the UI shouldn't offer moves it knows are illegal.
 */
function VoucherRowActions({ row }: { row: BuildVoucher }) {
  if (row.swapStatus === "swapped" || row.swapStatus === "forfeited") {
    // Terminal states — no actions.
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {row.swapStatus === "unswapped" && (
        <form action={markVoucherPendingSwap}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className="text-xs text-ink-muted hover:text-brand-magenta"
          >
            Queue for swap
          </button>
        </form>
      )}
      <form
        action={forfeitVoucher}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="id" value={row.id} />
        <input
          name="reason"
          type="text"
          placeholder="Forfeit reason (required)"
          required
          className="w-56 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-[11px]"
        />
        <button
          type="submit"
          className="text-[11px] text-ink-faint hover:text-brand-magenta"
        >
          Forfeit
        </button>
      </form>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "ink" | "muted";
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-semibold ${
          accent === "muted" ? "text-ink-faint" : "text-ink"
        }`}
      >
        {NUMBER_FMT.format(value)}
      </p>
    </div>
  );
}
