"use client";
import { Button } from "@/components/Button";

/**
 * Public /jobs/[id] apply form. Rendered for EVERYONE as of
 * 2026-11-03. It used to render only for signed-in users, and a
 * signed-out reader got a card telling them to sign in to see a brief
 * that was already fully on screen above it, which turned away the
 * exact person the posting was written for.
 *
 * Two submit paths behind one form:
 *   - signed in  -> submitJobApplication, a real job_applications row.
 *   - visitor    -> submitVisitorJobApplication, which lands in the
 *                   inbound triage queue AND stands as their
 *                   membership application. job_applications.user_id
 *                   is a non-null FK, so a visitor cannot hold a row
 *                   there until they are a member.
 *
 * The visitor variant asks for name and email because there is no
 * session to read them from. It says plainly that applying also puts
 * them forward for membership, rather than enrolling them quietly.
 *
 * Uses useActionState (React 19) to surface validation errors from
 * the server action inline, without navigating away from the
 * page — the failure path for "you already applied" or "pitch too
 * short" is a first-class UX moment, not a stack trace.
 */

import { useActionState } from "react";
import { submitJobApplication } from "@/lib/application-actions";
import type { ProposalResult } from "@/lib/application-actions";
import { submitVisitorJobApplication } from "@/lib/visitor-application-actions";
import { Card } from "@/components/Card";

interface Props {
  jobId: string;
  jobTitle: string;
  /** False for a signed-out visitor. Chooses the submit path. */
  isSignedIn: boolean;
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
async function memberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return submitJobApplication(formData);
}

async function visitorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return submitVisitorJobApplication(formData);
}

export function ApplyToJobForm({ jobId, jobTitle, isSignedIn }: Props) {
  const [state, formAction, isPending] = useActionState(
    isSignedIn ? memberAction : visitorAction,
    null,
  );

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
        {isSignedIn
          ? "Admin routes applications to the client lead within 48 hours."
          : "No account needed. Admin routes applications to the client lead within 48 hours, and applying here also puts you forward for Future Modern membership so you can be matched to future roles."}
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="jobTitle" value={jobTitle} />

        {!isSignedIn && (
          <>
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Your name <span className="text-ink-muted">(required)</span>
              </label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                autoComplete="name"
                className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-ink-muted">(required)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

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

        <Button
          type="submit"
          disabled={isPending}
          className="fm-btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </Card>
  );
}
