/**
 * Send this invoice to the client, from the app.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A CLIENT COMPONENT (2026-11-03)
 *
 * The action returns its outcome rather than throwing, for the reason
 * written on ApplyToJobForm: Next.js strips server-action error
 * messages in production, so "no billing email on file" would reach
 * the admin as "An error occurred in the Server Components render."
 * On a send-money surface that is the difference between fixing the
 * client record and assuming the app is broken.
 *
 * Presentational only. Every value arrives as a prop, so this never
 * touches the database and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  sendInvoiceToClient,
  type InvoiceDeliveryResult,
} from "@/lib/invoice-delivery-actions";

type FormState = InvoiceDeliveryResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return sendInvoiceToClient(formData);
}

interface Props {
  invoiceId: string;
  /** Billing contact on the client record, prefilled when known. */
  defaultEmail: string | null;
  /** Drafts cannot be sent; the button says why rather than hiding. */
  isDraft: boolean;
}

export function SendInvoiceToClient({
  invoiceId,
  defaultEmail,
  isDraft,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input
        name="toEmail"
        type="email"
        defaultValue={defaultEmail ?? ""}
        placeholder="Billing email"
        className="w-52 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
      />
      <Button
        type="submit"
        disabled={isPending || isDraft}
        title={
          isDraft
            ? "Issue the invoice first so the number the client files matches ours."
            : undefined
        }
        className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-elevated)] disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send to client"}
      </Button>
      {state && (
        <span
          className="text-xs"
          style={{ color: state.ok ? "#007048" : "#d84343" }}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
