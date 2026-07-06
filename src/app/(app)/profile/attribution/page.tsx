/**
 * Member-facing attribution ledger view (Phase 1.4).
 *
 * Shows every contract where the signed-in member has been credited, plus
 * any revenue split rows that have already paid out. Read-only —
 * corrections happen via admin offsetting entries on
 * /admin/contracts/[id]/attribution.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_ATTRIBUTION } from "@/lib/mock-data/attribution";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_SPLITS } from "@/lib/mock-data/splits";
import { MOCK_INVOICES } from "@/lib/mock-data/invoices";
import {
  ATTRIBUTION_ROLE_LABELS,
  INVOICE_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  type InvoiceStatus,
  type PayoutStatus,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const PAYOUT_COLOR: Record<PayoutStatus, string> = {
  pending: "#5070F0",
  queued: "#5070F0",
  sent: "#007048",
  failed: "#E53E3E",
};

const INVOICE_COLOR: Record<InvoiceStatus, string> = {
  draft: "#5070F0",
  issued: "#5070F0",
  partially_received: "#D828A0",
  received: "#007048",
  void: "#E53E3E",
};

export default async function MyAttributionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const entries = MOCK_ATTRIBUTION.filter((a) => a.userId === user.id).sort(
    (a, b) => b.loggedAt.localeCompare(a.loggedAt),
  );
  const payouts = MOCK_SPLITS.filter((s) => s.recipientId === user.id).sort(
    (a, b) => (b.payoutSentAt ?? "").localeCompare(a.payoutSentAt ?? ""),
  );

  // Group entries by contract for readable rendering.
  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!grouped.has(e.contractId)) grouped.set(e.contractId, []);
    grouped.get(e.contractId)!.push(e);
  }

  const lifetimePaid = payouts
    .filter((s) => s.payoutStatus === "sent")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/profile" className="text-sm text-ink-muted hover:text-ink">
        ← Your profile
      </Link>

      <h1 className="mt-3 font-display text-4xl font-semibold">
        Your attribution ledger
      </h1>
      <p className="mt-2 text-ink-muted">
        Every contract you&apos;ve been credited on, and every payout that
        ledger has produced. Append-only by design — corrections happen via
        offsetting entries from admin, never edits.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Ledger entries" value={`${entries.length}`} />
        <Stat label="Payout rows" value={`${payouts.length}`} />
        <Stat label="Lifetime paid" value={`$${lifetimePaid.toLocaleString()}`} />
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">By contract</h2>
        {grouped.size === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No attribution entries yet. As contracts move through delivery,
              admins log who contributed — that&apos;s where this list comes
              from.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-4">
            {Array.from(grouped.entries()).map(([contractId, items]) => {
              const project = MOCK_PROJECTS.find((p) => p.id === contractId);
              const totalWeight = items.reduce((sum, e) => sum + e.weight, 0);

              // AR status for transparency — contributors can see whether
              // the client has paid, without exposing anything PII-y.
              const invoices = MOCK_INVOICES.filter(
                (i) => i.contractId === contractId,
              );
              const totalIssued = invoices
                .filter(
                  (i) => i.status !== "draft" && i.status !== "void",
                )
                .reduce((sum, i) => sum + Number(i.total), 0);
              const totalReceived = invoices.reduce(
                (sum, i) => sum + Number(i.paidAmount),
                0,
              );
              const outstanding = totalIssued - totalReceived;

              return (
                <Card key={contractId}>
                  <CardEyebrow>{project ? "Contract" : "Unknown"}</CardEyebrow>
                  <CardTitle className="mt-1">
                    {project?.title ?? contractId}
                  </CardTitle>
                  {project?.collectedRevenue && (
                    <p className="mt-1 text-xs text-ink-faint">
                      Collected revenue:{" "}
                      <span className="text-ink">
                        ${Number(project.collectedRevenue).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {invoices.length > 0 && (
                    <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
                      <div className="text-xs uppercase tracking-wider text-ink-faint">
                        Client invoicing
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <MiniStat
                          label="Issued"
                          value={`$${totalIssued.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        />
                        <MiniStat
                          label="Received"
                          value={`$${totalReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                          accent={totalReceived > 0 ? "#007048" : undefined}
                        />
                        <MiniStat
                          label="Outstanding"
                          value={`$${outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                          accent={outstanding > 0 ? "#D828A0" : "#007048"}
                        />
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-ink-muted">
                        {invoices
                          .filter((i) => i.status !== "draft")
                          .map((i) => (
                            <li
                              key={i.id}
                              className="flex items-center justify-between gap-3"
                            >
                              <span>
                                {i.number} ·{" "}
                                <span className="text-ink-faint">
                                  due{" "}
                                  {i.dueAt
                                    ? new Date(i.dueAt).toLocaleDateString()
                                    : "—"}
                                </span>
                              </span>
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: `${INVOICE_COLOR[i.status]}26`,
                                  color: INVOICE_COLOR[i.status],
                                }}
                              >
                                {INVOICE_STATUS_LABELS[i.status]}
                              </span>
                            </li>
                          ))}
                      </ul>
                      <p className="mt-3 text-[11px] text-ink-faint">
                        Your payout dispatches after the invoice is marked
                        received and the admin runs settlement.
                      </p>
                    </div>
                  )}
                  <ul className="mt-4 space-y-2">
                    {items.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-start justify-between gap-3 rounded-lg bg-[var(--surface-inset)] px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">
                            {ATTRIBUTION_ROLE_LABELS[e.role]}
                          </div>
                          {e.notes && (
                            <p className="mt-1 text-xs text-ink-muted">
                              {e.notes}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-ink-faint">
                            Logged {new Date(e.loggedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-sm font-medium" style={{ color: "#5070F0" }}>
                          weight {e.weight.toFixed(2)}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {items.length > 1 && (
                    <p className="mt-3 text-xs text-ink-faint">
                      Combined weight on this contract: {totalWeight.toFixed(2)}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Payouts</h2>
        {payouts.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No payouts yet. They appear here once a contract you&apos;re
              credited on settles.
            </p>
          </Card>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="p-4 text-left">Sent</th>
                  <th className="p-4 text-left">Contract</th>
                  <th className="p-4 text-left">Pool</th>
                  <th className="p-4 text-right">Share</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((s) => {
                  const project = MOCK_PROJECTS.find(
                    (p) => p.id === s.contractId,
                  );
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-[var(--surface-border)]"
                    >
                      <td className="p-4 text-ink-muted">
                        {s.payoutSentAt
                          ? new Date(s.payoutSentAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="p-4">{project?.title ?? s.contractId}</td>
                      <td className="p-4 capitalize text-ink-muted">{s.pool}</td>
                      <td className="p-4 text-right">{s.sharePct}%</td>
                      <td className="p-4 text-right font-medium">
                        ${Number(s.amount).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
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
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded bg-[var(--surface-elevated)] px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div
        className="mt-0.5 text-sm font-semibold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
