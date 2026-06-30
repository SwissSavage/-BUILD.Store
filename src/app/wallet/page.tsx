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
import { COMP_STAGE_LABELS } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";
import { NotificationStrip } from "@/components/NotificationStrip";
import { WalletConnectCard } from "@/components/WalletConnectCard";

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const balance = getBalance(user.id);
  const txs = getTransactions(user.id);

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
