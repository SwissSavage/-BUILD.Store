/**
 * Admin: $BUILD distribution console.
 *
 * Two surfaces, both calling the same wallet stub:
 *   1) Manual distribution form — admin picks recipient + amount + reason.
 *      Logs a TokenTransaction; bumps balance.
 *   2) Recent distributions table — read of all transactions.
 *
 * In production, the manual form fires a multisig propose() call,
 * the project-completion event handler fires the same function
 * automatically when revenue settles, and this table reconciles
 * against on-chain events.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { distributeBuild } from "@/lib/wallet-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data/tokens";
import type { TokenTransaction } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

async function distribute(formData: FormData) {
  "use server";
  distributeBuild({
    toUserId: String(formData.get("toUserId")),
    amount: String(formData.get("amount")),
    type: String(formData.get("type")) as TokenTransaction["type"],
    projectId: String(formData.get("projectId") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
  });
  revalidatePath("/admin/tokens");
  revalidatePath("/admin");
  revalidatePath("/wallet");
  revalidatePath("/dashboard");
}

const TYPES: TokenTransaction["type"][] = [
  "project_completion",
  "referral",
  "collaboration",
  "governance",
  "admin_grant",
];

export default async function AdminTokensPage() {
  await requireAdmin();

  const recent = [...MOCK_TRANSACTIONS]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 25);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">$BUILD distribution</h1>
      <p className="mt-2 text-ink-muted">
        Manual distribution console. Production wires this to the multisig.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardEyebrow>New distribution</CardEyebrow>
          <CardTitle className="mt-2">Send $BUILD</CardTitle>
          <form action={distribute} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Recipient
              </span>
              <select
                name="toUserId"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
                required
              >
                {MOCK_USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Amount
              </span>
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Type
              </span>
              <select
                name="type"
                defaultValue="admin_grant"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Project (optional)
              </span>
              <input
                name="projectId"
                placeholder="p_001"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Description
              </span>
              <input
                name="description"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              Distribute
            </button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <h2 className="font-display text-2xl font-semibold">Recent distributions</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-left">Member</th>
                  <th className="p-4 text-left">Type</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => {
                  const u = MOCK_USERS.find((x) => x.id === tx.userId);
                  return (
                    <tr key={tx.id} className="border-t border-[var(--surface-border)]">
                      <td className="p-4 text-ink-muted">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        {u?.firstName} {u?.lastName}
                      </td>
                      <td className="p-4 capitalize">{tx.type.replace("_", " ")}</td>
                      <td className="p-4 text-right font-medium">
                        +{Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
