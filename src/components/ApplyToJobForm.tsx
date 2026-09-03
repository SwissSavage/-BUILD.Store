"use client";

/**
 * Public /jobs/[id] apply form. Rendered only for signed-in users;
 * the parent page gates on getCurrentUser() and shows a "sign in to
 * apply" card otherwise.
 *
 * Uses useActionState (React 19) to surface validation errors from
 * the server action inline, without navigating away from the
 * page — the failure path for "you already applied" or "pitch too
 * short" is a first-class UX moment, not a stack trace.
 */

import { useActionState } from "react";
import { submitJobApplication } from "@/lib/application-actions";
import type { ProposalResult } from "@/lib/application-actions";
import { Card } from "@/components/Card";

interface Props {
  jobId: string;
  jobTitle: string;
}

type FormState = ProposalResult | null;

/**
 * The action RETURNS its outcome now.
 *
 * Catching a thrown error gave the applicant nothing: Next.js strips
 * server-action error messages in production, so "you already applied"
 * arrived as "An error occurred in the Server Components render."
 * A real fault now carries a reference that matches the server log.
 */
async function action(_prev: FormState, formData: FormData): Promise<FormState> {
  return submitJobApplication(formData);
}

export function ApplyToJobForm({ jobId, jobTitle }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <Card>
        <p className="text-lg font-medium">Application in.</p>
        <p className="mt-2 text-sm text-ink-muted">{state.message}</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-lg font-medium">Apply for {jobTitle}</p>
      <p className="mt-2 text-sm text-ink-muted">
        Admin routes applications to the client lead within 48 hours.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="jobId" value={jobId} />

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
            placeholder="Why you're a fit — link to specific work if it helps."
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

        <div>
          <label htmlFor="desiredCompensation" className="text-sm font-medium">
            Desired compensation <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="desiredCompensation"
            name="desiredCompensation"
            type="text"
            placeholder="e.g. $140k or $95/hr"
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
          className="fm-btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </Card>
  );
}
