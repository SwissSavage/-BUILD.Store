/**
 * Tie this app's invoice record to the real invoice the client got.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS A CLIENT COMPONENT (2026-11-03)
 *
 * The action returns its outcome rather than throwing, for the reason
 * written on ApplyToJobForm: Next.js strips server-action error
 * messages in production, so "the invoice has to be a PDF" arrives as
 * "An error occurred in the Server Components render." A returned
 * result needs useActionState to be read, and useActionState needs a
 * client component.
 *
 * Presentational only. Every value arrives as a prop, so this never
 * reaches the database and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  attachInvoiceSourceDocument,
  type SourceDocumentResult,
} from "@/lib/invoice-source-document-actions";

type FormState = SourceDocumentResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return attachInvoiceSourceDocument(formData);
}

interface Props {
  invoiceId: string;
  /** Our own minted reference, shown so the contrast is obvious. */
  ourNumber: string;
  sourceDocumentNumber: string | null;
  sourceDocumentName: string | null;
}

export function InvoiceSourceDocumentForm({
  invoiceId,
  ourNumber,
  sourceDocumentNumber,
  sourceDocumentName,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className="mt-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        The real invoice
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        {ourNumber} is our own reference. Record the number the client
        actually received, and attach the document it came on.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          name="sourceDocumentNumber"
          defaultValue={sourceDocumentNumber ?? ""}
          placeholder="Found invoice no."
          className="w-44 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
        />
        <input
          name="sourceDocument"
          type="file"
          accept="application/pdf,.pdf"
          className="max-w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--surface-elevated)] file:px-3 file:py-1 file:text-xs file:text-ink"
        />
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-elevated)] disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
        {sourceDocumentName && (
          <a
            href={`/api/admin/invoices/${encodeURIComponent(invoiceId)}/source-document`}
            className="text-xs text-brand-magentaText hover:underline"
          >
            {sourceDocumentName} ↓
          </a>
        )}
      </div>

      {state && (
        <p
          className="mt-2 text-xs"
          style={{ color: state.ok ? "#007048" : "#d84343" }}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
