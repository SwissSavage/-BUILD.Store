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
import type { ProposalResult } from "@/lib/application-actions";
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
  /**
   * This contractor's current proposal, if they already have one.
   * Present means the form is an editor rather than a blank slate.
   */
  existing?: {
    attachments?: { name: string; sizeBytes: number }[] | null;
    proposedRole: string | null;
    pitch: string;
    hoursPerWeek: number | null;
    hourlyRate: string | null;
    portfolioLink: string | null;
    status: string;
    createdAt: string;
  } | null;
}

type FormState = ProposalResult | null;

/**
 * The action RETURNS its outcome now.
 *
 * This used to be a try/catch around a throwing action. Next.js strips
 * server-action error messages in production, so "you already bid on
 * this" reached the contractor as "An error occurred in the Server
 * Components render." A caught error told them nothing.
 */
async function action(_prev: FormState, formData: FormData): Promise<FormState> {
  // No catch. The action guards itself server-side and returns its
  // outcome; catching here would swallow the NEXT_REDIRECT that
  // next/navigation throws to send an expired session to sign-in,
  // leaving the contractor on a dead form.
  return submitContractBid(formData);
}

export function BidOnContractForm({
  contractId,
  contractTitle,
  rateBounds,
  existing,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const editing = !!existing && existing.status === "pending";
  const existingDocs = existing?.attachments ?? [];
  const locked = !!existing && existing.status === "approved";

  if (state?.ok) {
    return (
      <Card>
        <p className="text-lg font-medium">
          {state.mode === "updated" ? "Proposal updated." : "Proposal in."}
        </p>
        <p className="mt-2 text-sm text-ink-muted">{state.message}</p>
      </Card>
    );
  }

  if (locked) {
    return (
      <Card>
        <p className="text-lg font-medium">You are on this contract.</p>
        <p className="mt-2 text-sm text-ink-muted">
          Your proposal was selected, so the terms are locked for the
          duration. Message admin if something needs to change.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-lg font-medium">
        {editing ? "Your proposal" : `Bid on ${contractTitle}`}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        {editing
          ? "Submitted and awaiting selection. Edit anything below and resubmit to replace it."
          : "Admin compiles 3–5 proposals for the client; strongest matches surface first."}
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
              defaultValue={existing?.proposedRole ?? ""}
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
              defaultValue={existing?.hoursPerWeek ?? ""}
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
              defaultValue={existing?.hourlyRate ?? ""}
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
            defaultValue={existing?.pitch ?? ""}
            placeholder="Approach + relevant past work. Depersonalize any client names — Future Modern doesn't expose upstream clients."
            className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="attachments" className="text-sm font-medium">
            Portfolio documents{" "}
            <span className="text-ink-muted">(optional)</span>
          </label>
          <p className="mt-1 text-xs text-ink-faint">
            Case studies, decks, a resume. Up to 3 files, 2 MB each.
            Visible to admin only, never on the public board.
          </p>
          <input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.md"
            className="mt-2 w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-magenta file:px-4 file:py-2 file:text-sm file:text-white hover:file:opacity-90"
          />
          {editing && existingDocs.length > 0 && (
            <p className="mt-2 text-xs text-ink-faint">
              Already attached: {existingDocs.map((d) => d.name).join(", ")}.
              Picking new files replaces them; leaving this empty keeps
              them.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="portfolioLink" className="text-sm font-medium">
            Portfolio link <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="portfolioLink"
            name="portfolioLink"
            type="url"
            defaultValue={existing?.portfolioLink ?? ""}
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
          {isPending
            ? editing
              ? "Saving…"
              : "Submitting…"
            : editing
              ? "Update proposal"
              : "Submit proposal"}
        </button>
      </form>
    </Card>
  );
}
