/**
 * Record that a payout actually went out, and when.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A CLIENT COMPONENT (2026-11-03)
 *
 * The action returns its outcome rather than throwing, for the reason
 * written on ApplyToJobForm: Next strips server-action error messages
 * in production, so "enter the date the money actually went out" would
 * reach the admin as "An error occurred in the Server Components
 * render." On a surface that records payments, that is the difference
 * between fixing the input and assuming the app is broken.
 *
 * WHY THE DATE DEFAULTS TO EMPTY
 *
 * Not to today. Found has no API, so the money moves before anyone
 * opens the app, routinely days before. A prefilled today is a wrong
 * answer that looks like a right one, and the whole point of this
 * field is that the record carries the real date.
 *
 * WHY THE FEE FIELD IS OPTIONAL AND BLANK BY DEFAULT
 *
 * Blank means there was no fee, which is a different claim from 0.00.
 * Domestic Found and ACH cost nothing to send; a wire or a
 * cross-border rail does. It is recorded whoever bears it, because a
 * payment fee is a deductible expense and a deduction needs a number
 * and a date rather than a bank statement reconstructed a year later.
 *
 * And it records WHO paid, because the deduction follows the payer.
 * Jamar: "we wouldn't deduct fees, the deduction would go to whoever
 * incurred the fee." Recipient is the default because it is the rule;
 * treasury is the exception and has to be chosen deliberately.
 *
 * Presentational only: every value arrives as a prop, so this never
 * reaches the database and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  confirmManualPayout,
  type ManualPayoutResult,
} from "@/lib/payout-method-actions";

type FormState = ManualPayoutResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return confirmManualPayout(formData);
}

export function ConfirmManualPayout({ splitId }: { splitId: string }) {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <p className="shrink-0 text-sm" style={{ color: "#007048" }}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="shrink-0">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <input type="hidden" name="splitId" value={splitId} />

        <div>
          <label
            htmlFor={`sentOn-${splitId}`}
            className="block text-[11px] uppercase tracking-wider text-ink-muted"
          >
            Date sent
          </label>
          <input
            id={`sentOn-${splitId}`}
            name="sentOn"
            type="date"
            required
            className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor={`reference-${splitId}`}
            className="block text-[11px] uppercase tracking-wider text-ink-muted"
          >
            Reference
          </label>
          <input
            id={`reference-${splitId}`}
            name="reference"
            type="text"
            required
            placeholder="Confirmation #"
            className="mt-1 w-40 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor={`fee-${splitId}`}
            className="block text-[11px] uppercase tracking-wider text-ink-muted"
          >
            Fee
          </label>
          <input
            id={`fee-${splitId}`}
            name="payoutFee"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="mt-1 w-24 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor={`feeBorne-${splitId}`}
            className="block text-[11px] uppercase tracking-wider text-ink-muted"
          >
            Fee paid by
          </label>
          <select
            id={`feeBorne-${splitId}`}
            name="payoutFeeBorneBy"
            defaultValue="recipient"
            className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          >
            <option value="recipient">Recipient</option>
            <option value="treasury">Treasury</option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`doc-${splitId}`}
            className="block text-[11px] uppercase tracking-wider text-ink-muted"
          >
            Payout record (PDF)
          </label>
          <input
            id={`doc-${splitId}`}
            name="payoutDocument"
            type="file"
            accept="application/pdf,.pdf"
            className="mt-1 max-w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--surface-elevated)] file:px-3 file:py-1 file:text-xs file:text-ink"
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-magenta, #D828A0)" }}
        >
          {isPending ? "Recording…" : "Mark sent"}
        </Button>
      </div>

      {state && !state.ok && (
        <p className="mt-2 text-right text-xs" style={{ color: "#d84343" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
