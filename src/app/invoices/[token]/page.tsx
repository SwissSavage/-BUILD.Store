/**
 * Client-facing invoice view (Phase 1.5).
 *
 * Reached via a signed magic-link emailed to the client when an admin
 * issues an invoice. No login required — the token IS the credential.
 * Mirrors the /proposals/[token] pattern: PII-scrubbed, read-only,
 * contract context without exposing contributor names.
 *
 * What the client sees:
 *   - The cooperative's letterhead + their logical client label.
 *   - Invoice number, issue date, due date, status.
 *   - Line items. When the invoice is CC-opt-in, the processing-fee row
 *     is shown inline labeled "Payment processing fee (2.9% + $0.30)" —
 *     nothing hidden, nothing surprising.
 *   - Payment instructions:
 *       - Default (Mercury ACH/wire): coordinates for the cooperative's
 *         Mercury account, reference = invoice number.
 *       - CC opt-in: Stripe-hosted payment link (stub in sandbox).
 *   - Paid-to-date amount and remaining balance when partially received.
 *
 * What the client does NOT see:
 *   - Admin notes (clientInvoiceView strips `notes`).
 *   - Contributor names, attribution ledger, internal splits.
 *   - The Mercury transaction reference (that's for the cooperative's books).
 *
 * REPLACE WITH: Drizzle lookup on `invoices.client_token`, signed JWT
 * verification, audit log entry per view. Add a Stripe Checkout link
 * when `acceptsCard` + payment intent not yet created.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_INVOICES } from "@/lib/mock-data/invoices";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  clientInvoiceView,
  type InvoiceStatus,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

// Friendly client labels — identical to the proposals surface.
const CLIENT_LABELS: Record<string, string> = {
  client_url_media: "URL Media",
  client_dcg: "Direct Connect Global",
  client_bk_greenroots: "Brooklyn GreenRoots",
  client_arborai: "ArborAI",
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "#5070F0",
  issued: "#5070F0",
  partially_received: "#D828A0",
  received: "#007048",
  void: "#E53E3E",
};

export default async function ClientInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = MOCK_INVOICES.find((i) => i.clientToken === token);
  if (!record) notFound();

  // Drafts aren't visible to clients — that's admin-only preview state.
  if (record.status === "draft") notFound();

  const project = MOCK_PROJECTS.find((p) => p.id === record.contractId);
  const invoice = clientInvoiceView(record);

  const clientLabel =
    (project && CLIENT_LABELS[project.clientId]) ?? "Valued client";

  const remaining = Number(invoice.total) - Number(invoice.paidAmount);
  const isPaid = invoice.status === "received";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Letterhead */}
      <header className="border-b border-[var(--surface-border)] pb-6">
        <div className="text-xs uppercase tracking-wider text-brand-magenta">
          Future Modern Builderberg LLC
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Invoice {invoice.number}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Prepared for {clientLabel}
          {project ? ` — ${project.title}` : ""}.
        </p>
      </header>

      {/* Status + key dates */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Field
          label="Status"
          value={INVOICE_STATUS_LABELS[invoice.status]}
          accent={STATUS_COLOR[invoice.status]}
        />
        <Field
          label="Issued"
          value={
            invoice.issuedAt
              ? new Date(invoice.issuedAt).toLocaleDateString()
              : "—"
          }
        />
        <Field
          label="Due"
          value={
            invoice.dueAt
              ? new Date(invoice.dueAt).toLocaleDateString()
              : "On receipt"
          }
        />
      </div>

      {/* Line items */}
      <Card className="mt-8">
        <CardEyebrow>Line items</CardEyebrow>
        <CardTitle className="mt-2">Engagement summary</CardTitle>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr
                key={li.id}
                className="border-b border-[var(--surface-border)] last:border-b-0"
              >
                <td className="py-3">
                  <div>{li.description}</div>
                  {li.isProcessingFee && (
                    <p className="mt-1 text-xs text-ink-faint">
                      Added because this invoice is payable by card. Waived
                      automatically if you pay by ACH or wire to the cooperative
                      Mercury account.
                    </p>
                  )}
                </td>
                <td className="py-3 text-right font-mono text-sm">
                  ${Number(li.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-xs uppercase tracking-wider text-ink-faint">
                Subtotal
              </td>
              <td className="pt-4 text-right font-mono text-sm">
                ${Number(invoice.subtotal).toLocaleString()}
              </td>
            </tr>
            {Number(invoice.processingFee) > 0 && (
              <tr>
                <td className="py-1 text-xs uppercase tracking-wider text-ink-faint">
                  Processing fee
                </td>
                <td className="py-1 text-right font-mono text-sm">
                  ${Number(invoice.processingFee).toLocaleString()}
                </td>
              </tr>
            )}
            <tr>
              <td className="pt-2 text-sm font-semibold uppercase tracking-wider">
                Total due
              </td>
              <td className="pt-2 text-right font-display text-xl font-semibold">
                ${Number(invoice.total).toLocaleString()}
              </td>
            </tr>
            {Number(invoice.paidAmount) > 0 && (
              <>
                <tr>
                  <td
                    className="pt-2 text-xs uppercase tracking-wider"
                    style={{ color: "#007048" }}
                  >
                    Received to date
                  </td>
                  <td
                    className="pt-2 text-right font-mono text-sm"
                    style={{ color: "#007048" }}
                  >
                    −${Number(invoice.paidAmount).toLocaleString()}
                  </td>
                </tr>
                {!isPaid && (
                  <tr>
                    <td className="pt-2 text-sm font-semibold uppercase tracking-wider">
                      Remaining balance
                    </td>
                    <td className="pt-2 text-right font-display text-xl font-semibold">
                      ${remaining.toLocaleString()}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tfoot>
        </table>
      </Card>

      {/* Payment instructions */}
      {!isPaid && (
        <Card className="mt-6">
          <CardEyebrow>How to pay</CardEyebrow>
          <CardTitle className="mt-2">
            {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
          </CardTitle>
          {invoice.acceptsCard ? (
            <div className="mt-4 space-y-3 text-sm text-ink-muted">
              <p>
                This invoice accepts credit card payment via Stripe. Click the
                button below to complete payment on a secure Stripe-hosted page.
              </p>
              <p className="text-xs text-ink-faint">
                The processing fee line above covers Stripe&apos;s card fee so
                the cooperative nets the original subtotal. Prefer ACH/wire?
                Contact us at{" "}
                <a
                  href="mailto:billing@futuremodern.example"
                  className="underline hover:text-brand-magenta"
                >
                  billing@futuremodern.example
                </a>{" "}
                and we&apos;ll re-issue without the markup.
              </p>
              <button
                disabled
                className="rounded-full px-5 py-2 text-sm font-medium text-white opacity-60"
                style={{ backgroundColor: "#5070F0" }}
                title="Stripe Checkout is wired in production"
              >
                Pay ${Number(invoice.total).toLocaleString()} by card
              </button>
              <p className="text-[11px] italic text-ink-faint">
                Sandbox note: in production this opens a Stripe Checkout
                session tied to the contract&apos;s Connect account.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-ink-muted">
              <p>
                Please remit via ACH or wire to the cooperative&apos;s Mercury
                account. There&apos;s no processing fee on this payment
                method.
              </p>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4 font-mono text-xs leading-6">
                <div>
                  <span className="text-ink-faint">Account name:</span>{" "}
                  Future Modern Builderberg LLC
                </div>
                <div>
                  <span className="text-ink-faint">Bank:</span> Mercury
                  (Choice Financial Group)
                </div>
                <div>
                  <span className="text-ink-faint">Routing (ACH):</span>{" "}
                  XXXXXXXXX
                </div>
                <div>
                  <span className="text-ink-faint">Account number:</span>{" "}
                  XXXXXXXXXXXX
                </div>
                <div>
                  <span className="text-ink-faint">Reference:</span>{" "}
                  {invoice.number}
                </div>
              </div>
              <p className="text-xs text-ink-faint">
                Exact coordinates are emailed with the invoice. Include the
                invoice number as the payment reference so we can mark the
                contract as received without a callback.
              </p>
            </div>
          )}
        </Card>
      )}

      {isPaid && (
        <Card className="mt-6">
          <CardEyebrow>Paid in full</CardEyebrow>
          <p className="mt-3 text-sm text-ink-muted">
            Thank you. ${Number(invoice.paidAmount).toLocaleString()} received
            on{" "}
            {invoice.paidAt
              ? new Date(invoice.paidAt).toLocaleDateString()
              : "—"}
            . No further action required.
          </p>
        </Card>
      )}

      {/* Questions / support */}
      <Card className="mt-6">
        <p className="text-sm text-ink-muted">
          Questions? Reply to the email that delivered this invoice or reach
          us at{" "}
          <a
            href="mailto:billing@futuremodern.example"
            className="underline hover:text-brand-magenta"
          >
            billing@futuremodern.example
          </a>
          .
        </p>
      </Card>

      <footer className="mt-8 text-xs text-ink-faint">
        <p>
          Future Modern Builderberg LLC · cooperative talent operating at the
          union of art and science.
        </p>
        <p className="mt-1">
          This page is scoped to this invoice only and will be deactivated
          once the payment is reconciled.
        </p>
      </footer>

      <div className="mt-8">
        <Link
          href="https://futuremodern.example"
          className="text-xs text-ink-faint hover:text-ink-muted"
        >
          ↗ futuremodern.example
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div
        className="mt-1 text-sm font-semibold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
