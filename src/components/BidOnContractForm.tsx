"use client";

/**
 * Public /contracts/[id] bid form. Writes to project_applications
 * (contracts are projects with kind='contract'). Rendered only when
 * signed in; parent page gates on getCurrentUser().
 *
 * Field parity with the quote-request workflow: pitch, proposed role,
 * hours/week, portfolio link. The compiled 3–5 card summary the
 * client sees at /projects/[id]/quotes is generated from these
 * fields — see task #39.
 */

import { useActionState } from "react";
import { submitContractBid } from "@/lib/application-actions";
import { Card } from "@/components/Card";

interface Props {
  contractId: string;
  contractTitle: string;
  /** Global platform bid range. Same for everyone — talent sets
   *  their own rate; admin reviews outliers during triage. */
  rateBounds: {
    minRate: number;
    maxRate: number;
    reason: string;
  };
}

type FormState = { ok: boolean; message: string } | null;

async function action(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await submitContractBid(formData);
    return { ok: true, message: "Bid submitted. Admin will reply soon." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, message: msg };
  }
}

export function BidOnContractForm({
  contractId,
  contractTitle,
  rateBounds,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <Card>
        <p className="text-lg font-medium">Thanks — bid in.</p>
        <p className="mt-2 text-sm text-ink-muted">{state.message}</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-lg font-medium">Bid on {contractTitle}</p>
      <p className="mt-2 text-sm text-ink-muted">
        Admin compiles 3–5 bids for the client; strongest matches surface
        first.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="contractId" value={contractId} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="proposedRole" className="text-sm font-medium">
              Proposed role
            </label>
            <input
              id="proposedRole"
              name="proposedRole"
              type="text"
              placeholder="e.g. RevOps Strategist"
              className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="hoursPerWeek" className="text-sm font-medium">
              Hours per week
            </label>
            <input
              id="hoursPerWeek"
              name="hoursPerWeek"
              type="number"
              min={1}
              max={80}
              placeholder="20"
              className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="hourlyRate" className="text-sm font-medium">
              Hourly rate (USD)
            </label>
            <input
              id="hourlyRate"
              name="hourlyRate"
              type="number"
              required
              min={rateBounds.minRate}
              max={rateBounds.maxRate}
              step={5}
              placeholder={`${rateBounds.minRate}–${rateBounds.maxRate}`}
              className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="rounded-md border border-dashed border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs text-ink-muted">
          <div className="font-medium text-ink">
            Bid range: ${rateBounds.minRate}–${rateBounds.maxRate}/hr
          </div>
          <p className="mt-1">{rateBounds.reason}</p>
          <p className="mt-1 text-ink-faint">
            The rate you set at engagement acceptance is locked for
            the duration — do not re-anchor after acceptance.
          </p>
        </div>

        <div>
          <label htmlFor="pitch" className="text-sm font-medium">
            Pitch <span className="text-ink-muted">(required)</span>
          </label>
          <textarea
            id="pitch"
            name="pitch"
            required
            minLength={20}
            rows={5}
            placeholder="Approach + relevant past work. Depersonalize any client names — Future Modern doesn't expose upstream clients."
            className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="portfolioLink" className="text-sm font-medium">
            Portfolio link <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="portfolioLink"
            name="portfolioLink"
            type="url"
            placeholder="https://…"
            className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
          />
        </div>

        {state && !state.ok && (
          <p className="text-sm" style={{ color: "#d84343" }}>
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit bid"}
        </button>
      </form>
    </Card>
  );
}
