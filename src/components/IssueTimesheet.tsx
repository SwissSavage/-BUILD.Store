/**
 * Freeze the logged hours into the document the client receives.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A CLIENT COMPONENT (2026-11-20)
 *
 * issueTimesheet refuses for several reasons an admin needs to read:
 * no hourly rate on the engagement, not an hourly engagement at all,
 * or no billable hours logged yet. In production Next would render
 * every one of those as "An error occurred in the Server Components
 * render."
 *
 * WHY IT SHOWS THE TOKEN AFTER ISSUING
 *
 * The sheet is only useful once somebody can send it. Returning the
 * client URL here means the admin does not have to go looking for
 * the row they just created.
 *
 * Presentational only: the project id arrives as a prop.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  issueTimesheet,
  type IssueTimesheetResult,
} from "@/lib/timesheet-actions";

type FormState = IssueTimesheetResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return issueTimesheet(formData);
}

export function IssueTimesheet({
  projectId,
  isRevision,
}: {
  projectId: string;
  /** Changes the wording when an earlier sheet exists. */
  isRevision: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.ok && state.clientToken) {
    return (
      <div className="mt-3 text-sm">
        <p style={{ color: "#007048" }}>{state.message}</p>
        <p className="mt-1 break-all text-xs text-ink-muted">
          Client link: <code>/timesheets/{state.clientToken}</code>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="projectId" value={projectId} />
      {/*
        A revision supersedes the last issued sheet, and the
        reconciliation line is computed from that chain rather than
        typed. See src/lib/timesheet.ts on why that sentence is where
        double billing happens.
      */}
      <input
        type="hidden"
        name="kindLabel"
        value={isRevision ? "Combined timesheet" : "Timesheet"}
      />
      <Button
        type="submit"
        disabled={isPending}
        className="rounded-full px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "#D828A0" }}
      >
        {isPending
          ? "Issuing…"
          : isRevision
            ? "Issue a combined sheet →"
            : "Issue the timesheet →"}
      </Button>
      {state && !state.ok && (
        <p className="mt-2 max-w-md text-xs" style={{ color: "#d84343" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
