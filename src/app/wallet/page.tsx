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
                  <th className="p-4 text-left">Project</th>
                  <th className="p-4 text-left">Description</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((tx) => (
                  <tr key={tx.id} className="border-t border-[var(--surface-border)]">
                    <td className="p-4 text-ink-muted">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 capitalize">{tx.type.replace("_", " ")}</td>
                    <td className="p-4 text-ink-muted">{tx.projectId ?? "—"}</td>
                    <td className="p-4 text-ink-muted">{tx.description ?? "—"}</td>
                    <td className="p-4 text-right font-medium">
                      +{Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
