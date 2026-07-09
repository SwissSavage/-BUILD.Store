/**
 * Admin AR/AP tracker per contract (Phase 1.5).
 *
 * One page that shows:
 *   - AR: every invoice on this contract — draft / issued / partially
 *     received / received. Admins can issue a draft, mark received via
 *     Mercury, toggle CC opt-in (gross-up calculator inserts the locked
 *     processing-fee row), open the client magic-link.
 *
 *   - AP: queued and sent payouts already produced by the split engine
 *     (splits.ts). Read-only here; the canonical AP surface is the
 *     settlement page, but admins should be able to see "what's still
 *     queued to leave the cooperative" without flipping tabs.
 *
 * Mutations write to in-memory MOCK_INVOICES / MOCK_PROJECTS — same
 * pattern as settle/page.tsx. REPLACE WITH: Drizzle inserts +
 * Mercury reconciliation worker that flips status when the deposit
 * lands.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_INVOICES } from "@/lib/mock-data/invoices";
import { MOCK_SPLITS } from "@/lib/mock-data/splits";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { RESERVE_RECIPIENTS } from "@/lib/mock-data/splits";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYOUT_STATUS_LABELS,
  adminName,
  type Invoice,
  type InvoiceStatus,
  type PayoutStatus,
} from "@/lib/types";
import {
  buildProcessingFeeLineItem,
  sumSubtotal,
} from "@/lib/payments-fees";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "#5070F0",
  issued: "#5070F0",
  partially_received: "#D828A0",
  received: "#007048",
  void: "#E53E3E",
};

const PAYOUT_COLOR: Record<PayoutStatus, string> = {
  pending: "#5070F0",
  queued: "#5070F0",
  sent: "#007048",
  failed: "#E53E3E",
};

function recalcInvoiceTotals(invoice: Invoice): void {
  const sub = sumSubtotal(invoice.lineItems);
  const fee = invoice.lineItems
    .filter((li) => li.isProcessingFee)
    .reduce((acc, li) => acc + Number(li.amount), 0);
  invoice.subtotal = sub.toFixed(2);
  invoice.processingFee = fee.toFixed(2);
  invoice.total = (sub + fee).toFixed(2);
  invoice.updatedAt = new Date().toISOString();
}

async function issueInvoice(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");

  const id = String(formData.get("invoiceId") ?? "");
  const dueAt = String(formData.get("dueAt") ?? "");
  const inv = MOCK_INVOICES.find((i) => i.id === id);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error("Only drafts can be issued");

  const now = new Date().toISOString();
  inv.issuedAt = now;
  inv.dueAt = dueAt ? new Date(dueAt).toISOString() : null;
  inv.status = "issued";
  inv.number = inv.number.replace(/^FM-2026-DRAFT-/, "FM-2026-");
  recalcInvoiceTotals(inv);

  revalidatePath(`/admin/contracts/${inv.contractId}/ledger`);
}

async function markReceived(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");

  const id = String(formData.get("invoiceId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reference = String(formData.get("reference") ?? "");
  const inv = MOCK_INVOICES.find((i) => i.id === id);
  if (!inv) throw new Error("Invoice not found");
  if (amount <= 0) throw new Error("Amount must be > 0");

  const now = new Date().toISOString();
  const newPaid = Number(inv.paidAmount) + amount;
  inv.paidAmount = newPaid.toFixed(2);
  inv.paidAt = now;
  inv.mercuryReference = reference || inv.mercuryReference || `merc_${Date.now()}`;
  inv.status =
    newPaid + 0.005 >= Number(inv.total) ? "received" : "partially_received";
  inv.updatedAt = now;

  // Sync the contract's collectedRevenue so the settle page picks it up
  // when the AR is fully received.
  const project = MOCK_PROJECTS.find((p) => p.id === inv.contractId);
  if (project && inv.status === "received") {
    // Sum every received invoice on this contract and put it on the project.
    const totalReceived = MOCK_INVOICES.filter(
      (i) => i.contractId === project.id && i.status === "received",
    ).reduce((acc, i) => acc + Number(i.subtotal), 0);
    project.collectedRevenue = totalReceived.toFixed(2);
    project.collectedAt = now;
    project.updatedAt = now;
  }

  revalidatePath(`/admin/contracts/${inv.contractId}/ledger`);
  revalidatePath(`/admin/contracts/${inv.contractId}/settle`);
}

async function toggleCardOptIn(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");

  const id = String(formData.get("invoiceId") ?? "");
  const inv = MOCK_INVOICES.find((i) => i.id === id);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "received" || inv.status === "void") {
    throw new Error("Cannot change rail on a closed invoice");
  }

  // Strip any existing processing-fee row, then either re-add (if turning on)
  // or leave off (turning off). The calculator owns that row.
  inv.lineItems = inv.lineItems.filter((li) => !li.isProcessingFee);
  if (!inv.acceptsCard) {
    // Turn on.
    const sub = sumSubtotal(inv.lineItems);
    inv.lineItems.push(buildProcessingFeeLineItem(sub));
    inv.acceptsCard = true;
    inv.paymentMethod = "cc_stripe";
  } else {
    // Turn off → revert to Mercury default.
    inv.acceptsCard = false;
    inv.paymentMethod = "ach_mercury";
    inv.stripePaymentIntentId = null;
  }
  recalcInvoiceTotals(inv);

  revalidatePath(`/admin/contracts/${inv.contractId}/ledger`);
}

async function createDraft(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");

  const contractId = String(formData.get("contractId") ?? "");
  const description = String(formData.get("description") ?? "Engagement fee");
  const amount = Number(formData.get("amount") ?? 0);
  if (amount <= 0) throw new Error("Amount must be > 0");

  const id = `inv_${contractId}_${Date.now()}`;
  const now = new Date().toISOString();
  MOCK_INVOICES.push({
    id,
    contractId,
    number: `FM-2026-DRAFT-${Math.floor(Math.random() * 9000) + 1000}`,
    clientToken: `tok_${id}`,
    status: "draft",
    paymentMethod: "ach_mercury",
    acceptsCard: false,
    lineItems: [
      {
        id: `li_${id}_1`,
        description,
        amount: amount.toFixed(2),
      },
    ],
    subtotal: amount.toFixed(2),
    processingFee: "0.00",
    total: amount.toFixed(2),
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    paidAmount: "0.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/admin/contracts/${contractId}/ledger`);
}

export default async function ContractLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) redirect("/dashboard");

  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project || project.kind !== "contract") notFound();

  const invoices = MOCK_INVOICES.filter((i) => i.contractId === id);
  const splits = MOCK_SPLITS.filter((s) => s.contractId === id);

  // AR roll-ups.
  const totalIssued = invoices
    .filter((i) => i.status !== "draft" && i.status !== "void")
    .reduce((acc, i) => acc + Number(i.total), 0);
  const totalReceived = invoices.reduce(
    (acc, i) => acc + Number(i.paidAmount),
    0,
  );
  const outstandingAR = totalIssued - totalReceived;

  // AP roll-ups (what the cooperative still owes out).
  const apQueued = splits
    .filter((s) => s.payoutStatus === "queued" || s.payoutStatus === "pending")
    .reduce((acc, s) => acc + Number(s.amount), 0);
  const apSent = splits
    .filter((s) => s.payoutStatus === "sent")
    .reduce((acc, s) => acc + Number(s.amount), 0);
  const apFailed = splits
    .filter((s) => s.payoutStatus === "failed")
    .reduce((acc, s) => acc + Number(s.amount), 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/admin/contracts"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Contract operations
      </Link>

      <header className="mt-3">
        <CardEyebrow>AR / AP tracker</CardEyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {project.title}
        </h1>
        <p className="mt-2 text-ink-muted">
          Invoices, payments, and outbound payouts in one place. Mercury is
          the default rail — flip the CC toggle on any individual invoice when
          a client needs card payment, and the gross-up line item gets baked
          in so the cooperative still nets the original subtotal.
        </p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat
          label="Issued (AR)"
          value={`$${totalIssued.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color="#5070F0"
        />
        <Stat
          label="Received"
          value={`$${totalReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color="#007048"
        />
        <Stat
          label="Outstanding AR"
          value={`$${outstandingAR.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color={outstandingAR > 0 ? "#D828A0" : "#007048"}
        />
      </div>

      {/* ────────────────────────  AR section  ──────────────────────── */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Invoices</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Send invoices to the client, mark them received once Mercury
              shows the deposit, or opt this invoice into card payment.
            </p>
          </div>
        </div>

        {invoices.length === 0 && (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No invoices on this contract yet — create the first one below.
            </p>
          </Card>
        )}

        <div className="mt-4 space-y-4">
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </div>

        <Card className="mt-6">
          <CardTitle>Add invoice (draft)</CardTitle>
          <p className="mt-1 text-xs text-ink-faint">
            Drafts are admin-only — the client doesn&apos;t see them until you
            issue. Default rail is Mercury; toggle CC after creating if needed.
          </p>
          <form
            action={createDraft}
            className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]"
          >
            <input type="hidden" name="contractId" value={project.id} />
            <input
              name="description"
              placeholder="Line item description (e.g. Milestone 2 — design pass)"
              required
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount (USD)"
              required
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#5070F0" }}
            >
              Create draft
            </button>
          </form>
        </Card>
      </section>

      {/* ────────────────────────  AP section  ──────────────────────── */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Outbound payouts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Mirrors the split engine. Read-only here — for changes, run{" "}
          <Link
            href={`/admin/contracts/${id}/settle`}
            className="underline hover:text-brand-magenta"
          >
            settlement
          </Link>
          .
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat
            label="Queued"
            value={`$${apQueued.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            color="#5070F0"
          />
          <Stat
            label="Sent"
            value={`$${apSent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            color="#007048"
          />
          <Stat
            label="Failed"
            value={`$${apFailed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            color={apFailed > 0 ? "#E53E3E" : "#5070F0"}
          />
        </div>

        {splits.length === 0 && (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No payouts dispatched yet. The split engine writes rows here
              after settlement.
            </p>
          </Card>
        )}

        {splits.length > 0 && (
          <Card className="mt-4">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 text-left">Recipient</th>
                  <th className="py-2 text-left">Pool</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s) => {
                  const recipient =
                    MOCK_USERS.find((u) => u.id === s.recipientId);
                  const reserve = RESERVE_RECIPIENTS.find(
                    (r) => r.id === s.recipientId,
                  );
                  const label = recipient
                    ? adminName(recipient)
                    : reserve?.label ?? s.recipientId;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--surface-border)]"
                    >
                      <td className="py-3 font-medium">{label}</td>
                      <td className="py-3 capitalize text-ink-muted">
                        {s.pool}
                      </td>
                      <td className="py-3 text-right">
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
        )}
      </section>
    </div>
  );

  function InvoiceRow({ invoice }: { invoice: Invoice }) {
    const isDraft = invoice.status === "draft";
    const isClosed =
      invoice.status === "received" || invoice.status === "void";
    const remaining = Number(invoice.total) - Number(invoice.paidAmount);

    return (
      <div
        className="rounded-2xl border border-[var(--surface-border)] border-l-4 bg-[var(--surface-elevated)] p-6"
        style={{ borderLeftColor: STATUS_COLOR[invoice.status] }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-faint">
              {invoice.number}
            </div>
            <CardTitle className="mt-1">
              ${Number(invoice.total).toLocaleString()}{" "}
              <span className="text-sm font-normal text-ink-muted">
                · {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
              </span>
            </CardTitle>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${STATUS_COLOR[invoice.status]}26`,
              color: STATUS_COLOR[invoice.status],
            }}
          >
            {INVOICE_STATUS_LABELS[invoice.status]}
          </span>
        </div>

        <table className="mt-4 w-full text-sm">
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr
                key={li.id}
                className="border-b border-[var(--surface-border)] last:border-b-0"
              >
                <td className="py-2 text-ink-muted">
                  {li.description}
                  {li.isProcessingFee && (
                    <span className="ml-2 rounded bg-[var(--surface-inset)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      Auto · gross-up
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-mono text-xs">
                  ${Number(li.amount).toLocaleString()}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2 text-xs uppercase tracking-wider text-ink-faint">
                Subtotal
              </td>
              <td className="py-2 text-right font-mono text-xs">
                ${Number(invoice.subtotal).toLocaleString()}
              </td>
            </tr>
            {Number(invoice.processingFee) > 0 && (
              <tr>
                <td className="py-2 text-xs uppercase tracking-wider text-ink-faint">
                  Processing fee
                </td>
                <td className="py-2 text-right font-mono text-xs">
                  ${Number(invoice.processingFee).toLocaleString()}
                </td>
              </tr>
            )}
            <tr>
              <td className="py-2 text-xs uppercase tracking-wider text-ink-faint">
                Total
              </td>
              <td className="py-2 text-right font-mono text-xs font-semibold">
                ${Number(invoice.total).toLocaleString()}
              </td>
            </tr>
            {Number(invoice.paidAmount) > 0 && (
              <tr>
                <td className="py-2 text-xs uppercase tracking-wider text-ink-faint">
                  Received
                </td>
                <td
                  className="py-2 text-right font-mono text-xs"
                  style={{ color: "#007048" }}
                >
                  ${Number(invoice.paidAmount).toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {(invoice.mercuryReference || invoice.stripePaymentIntentId) && (
          <p className="mt-3 font-mono text-xs text-ink-faint">
            {invoice.mercuryReference ?? invoice.stripePaymentIntentId}
          </p>
        )}

        {invoice.notes && (
          <p className="mt-3 text-xs italic text-ink-muted">
            Note: {invoice.notes}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--surface-border)] pt-4">
          {isDraft && (
            <form action={issueInvoice} className="flex items-center gap-2">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input
                name="dueAt"
                type="date"
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "#D828A0" }}
              >
                Issue invoice
              </button>
            </form>
          )}

          {!isDraft && !isClosed && (
            <form
              action={markReceived}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={remaining.toFixed(2)}
                className="w-28 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                placeholder="Amount"
              />
              <input
                name="reference"
                placeholder="Mercury ref"
                className="w-36 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "#007048" }}
              >
                Mark received
              </button>
            </form>
          )}

          {!isClosed && (
            <form action={toggleCardOptIn}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <button
                type="submit"
                className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-inset)]"
              >
                {invoice.acceptsCard ? "Disable CC" : "Opt into CC (gross-up)"}
              </button>
            </form>
          )}

          {!isDraft && (
            <Link
              href={`/invoices/${invoice.clientToken}`}
              target="_blank"
              className="ml-auto rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-inset)]"
            >
              Open client view ↗
            </Link>
          )}
        </div>
      </div>
    );
  }
}

function Stat({
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
      <div
        className="mt-2 font-display text-2xl font-semibold"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
