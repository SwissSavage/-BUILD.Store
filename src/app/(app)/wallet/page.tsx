/**
 * Member wallet. Shows $BUILD balance, wallet address, and the
 * full token transaction history for the signed-in user.
 *
 * Read-only for members. Admin-initiated distributions happen in
 * /admin/tokens and show up here after they fire (stub today,
 * real multisig flow in production).
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { getBalance, getTransactions } from "@/lib/wallet-stub";
import { vouchersForUser } from "@/lib/mock-data/vouchers";
import {
  BUILD_VOUCHER_SOURCE_TYPE_LABELS,
  BUILD_VOUCHER_SWAP_STATUS_LABELS,
  COMP_STAGE_LABELS,
} from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";
import { NotificationStrip } from "@/components/NotificationStrip";
import { WalletConnectCard } from "@/components/WalletConnectCard";

const NUMBER_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const [balance, txs] = await Promise.all([
    getBalance(user.id),
    getTransactions(user.id),
  ]);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Wallet</h1>

      <NotificationStrip
        userId={user.id}
        kinds={["split_distributed", "invoice_received"]}
        surfaceLabel="Wallet"
      />

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardEyebrow>$BUILD balance</CardEyebrow>
          <div className="mt-2 font-display text-4xl font-semibold">
            {Number(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-xs text-ink-faint">$BUILD tokens</p>
        </Card>

        <Card className="md:col-span-2">
          <CardEyebrow>Token-bound account</CardEyebrow>
          <div className="mt-2 text-sm text-ink-muted">ERC-6551 address</div>
          <div className="mt-1 break-all font-mono text-sm">
            {user.walletAddress ?? "Not yet provisioned"}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Production: reads live balance from chain via viem/wagmi; today this
            is the cooperative ledger value.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <WalletConnectCard
          connectedAddress={user.connectedWalletAddress}
          connectedProvider={user.connectedWalletProvider}
          connectedAt={user.walletConnectedAt}
        />
      </div>

      {(() => {
        const vouchers = vouchersForUser(user.id);
        const unswapped = vouchers
          .filter((v) => v.swapStatus === "unswapped")
          .reduce((sum, v) => sum + Number(v.amount), 0);
        const pending = vouchers
          .filter((v) => v.swapStatus === "pending_swap")
          .reduce((sum, v) => sum + Number(v.amount), 0);
        const swapped = vouchers
          .filter((v) => v.swapStatus === "swapped")
          .reduce((sum, v) => sum + Number(v.amount), 0);
        const forfeited = vouchers
          .filter((v) => v.swapStatus === "forfeited")
          .reduce((sum, v) => sum + Number(v.amount), 0);

        return (
          <section className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">
                $BUILD vouchers
              </h2>
              <p className="text-[11px] text-ink-faint">
                Off-chain claim on the real token
              </p>
            </div>
            <Card className="mt-4">
              <p className="text-sm text-ink-muted">
                Vouchers are the cooperative&apos;s accounting mirror
                of $BUILD. Once the real token is under a multisig
                contract (or a fresh spin-up if the dispute resolves
                that way), pending vouchers swap 1:1 into on-chain
                $BUILD. Forfeited vouchers stay in the record but
                no longer swap.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                <VoucherStatCell
                  label="Unswapped"
                  value={unswapped}
                  accent="ink"
                />
                <VoucherStatCell
                  label="Pending swap"
                  value={pending}
                  accent="ink"
                />
                <VoucherStatCell
                  label="Swapped"
                  value={swapped}
                  accent="muted"
                />
                <VoucherStatCell
                  label="Forfeited"
                  value={forfeited}
                  accent="muted"
                />
              </div>

              {vouchers.length === 0 ? (
                <p className="mt-6 text-sm text-ink-faint">
                  No vouchers on file yet.
                </p>
              ) : (
                <ul className="mt-6 divide-y divide-[var(--surface-border)]">
                  {vouchers.map((v) => (
                    <li key={v.id} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {NUMBER_FMT.format(Number(v.amount))}{" "}
                            <span className="text-ink-faint">
                              ·{" "}
                              {
                                BUILD_VOUCHER_SOURCE_TYPE_LABELS[
                                  v.sourceType
                                ]
                              }
                            </span>
                          </p>
                          <p className="text-[11px] text-ink-faint">
                            <span className="uppercase tracking-wider">
                              {BUILD_VOUCHER_SWAP_STATUS_LABELS[v.swapStatus]}
                            </span>
                            {" · issued "}
                            <span title={v.issuedAt}>
                              {v.issuedAt.slice(0, 10)}
                            </span>
                          </p>
                        </div>
                        {v.swappedToTxHash && (
                          <p className="max-w-full break-all text-[10px] text-ink-faint">
                            <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
                              {v.swappedToTxHash.slice(0, 24)}…
                            </code>
                          </p>
                        )}
                      </div>
                      {v.notes && (
                        <p className="mt-1 text-[11px] italic text-ink-muted">
                          {v.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        );
      })()}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Transaction history</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          {txs.length === 0 ? (
            <div className="p-6 text-sm text-ink-muted">No transactions yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-left">Type</th>
                  <th className="p-4 text-left">Stage</th>
                  <th className="p-4 text-left">Project</th>
                  <th className="p-4 text-left">Description</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((tx) => {
                  const stageColor =
                    tx.compStage === "base"
                      ? { bg: "rgba(0, 112, 72, 0.12)", fg: "#007048" }
                      : tx.compStage === "bonus_released"
                        ? { bg: "rgba(212, 175, 55, 0.18)", fg: "#D4AF37" }
                        : tx.compStage === "bonus_withheld"
                          ? { bg: "rgba(216, 40, 160, 0.12)", fg: "#D828A0" }
                          : null;
                  const isWithheld = tx.compStage === "bonus_withheld";
                  return (
                    <tr
                      key={tx.id}
                      className="border-t border-[var(--surface-border)]"
                    >
                      <td className="p-4 text-ink-muted">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 capitalize">
                        {tx.type.replace(/_/g, " ")}
                      </td>
                      <td className="p-4">
                        {stageColor ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                            style={{
                              backgroundColor: stageColor.bg,
                              color: stageColor.fg,
                            }}
                          >
                            {COMP_STAGE_LABELS[tx.compStage!]}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="p-4 text-ink-muted">{tx.projectId ?? "—"}</td>
                      <td className="p-4 text-ink-muted">
                        {tx.description ?? "—"}
                        {isWithheld && tx.withholdReason && (
                          <div className="mt-1 text-[11px] text-brand-magenta">
                            Reason: {tx.withholdReason}
                          </div>
                        )}
                      </td>
                      <td
                        className={`p-4 text-right font-medium ${isWithheld ? "line-through text-ink-faint" : ""}`}
                      >
                        {isWithheld ? "—" : "+"}
                        {isWithheld
                          ? Number(tx.amount).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                          : Number(tx.amount).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="px-6 pb-6 pt-3 text-[11px] text-ink-faint">
            <strong>Base</strong> = guaranteed floor released on milestone
            schedule. <strong>Bonus released</strong> = performance ceiling
            paid at engagement close (client rating ≥ 4 or composite
            fallback). <strong>Bonus withheld</strong> = ceiling reclaimed
            to the engagement recovery pool when the gate didn&apos;t
            clear; entry shows the notional amount + reason so the
            conditioning is visible.
          </p>
        </div>
      </section>
    </div>
  );
}

function VoucherStatCell({
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
