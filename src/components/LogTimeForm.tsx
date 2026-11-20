/**
 * Where a Builder enters the hours that become the client's timesheet.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A CLIENT COMPONENT (2026-11-20)
 *
 * Same reason as ConfirmManualPayout. Next strips server-action error
 * messages in production, so "round to the nearest quarter hour"
 * would reach the Builder as "An error occurred in the Server
 * Components render." logTimeEntry returns its outcome rather than
 * throwing, and this renders it.
 *
 * It matters more here than usual because the validation is
 * opinionated: the action REJECTS a figure that is not a quarter hour
 * rather than silently rounding it, on the grounds that somebody who
 * meant 0.3 should be told rather than quietly paid for 0.25. A
 * refusal nobody can read is just a broken button.
 *
 * WHY NO RATE FIELD
 *
 * Deliberate, and enforced in the action too. The rate comes off
 * projects.engagementRate, which the schema documents as
 * "Client-facing rate or total. Never shown to the Builder." Two PDFs
 * arrived for the CVC job, $150/hr and $176.47/hr, the same hours
 * seen from the two ends of the 85 percent split. Letting a Builder
 * type a rate is how those two numbers get confused on a document
 * that goes to a client.
 *
 * WHY THE DESCRIPTION WARNS
 *
 * It is not an internal note. It is the line the client reads on the
 * black form, verbatim, under "Work performed". The placeholder says
 * so because the first draft of anything is written as if nobody will
 * see it.
 *
 * Presentational only: every value arrives as a prop, so this never
 * reaches the database and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { logTimeEntry, type TimeEntryResult } from "@/lib/timesheet-actions";

type FormState = TimeEntryResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return logTimeEntry(formData);
}

const field =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm";
const label =
  "block text-[11px] uppercase tracking-wider text-ink-muted";

export function LogTimeForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="grid gap-3 sm:grid-cols-[150px_110px_1fr]">
        <div>
          <label htmlFor="workDate" className={label}>
            Date worked
          </label>
          {/*
            No default. Hours get logged days late as a matter of
            course on a rail where the client is invoiced monthly, and
            a prefilled today is a wrong answer that looks like a
            right one.
          */}
          <input
            id="workDate"
            name="workDate"
            type="date"
            required
            className={field}
          />
        </div>

        <div>
          <label htmlFor="hours" className={label}>
            Hours
          </label>
          <input
            id="hours"
            name="hours"
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            required
            placeholder="0.75"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="description" className={label}>
            Work performed
          </label>
          <input
            id="description"
            name="description"
            type="text"
            required
            maxLength={300}
            placeholder="The client reads this line exactly as you write it."
            className={field}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="precision" className={label}>
            How exact is this?
          </label>
          <select
            id="precision"
            name="precision"
            defaultValue="exact"
            className={`${field} w-auto`}
          >
            <option value="exact">Measured</option>
            <option value="estimated">Estimated</option>
            <option value="provisional">Start/break times unconfirmed</option>
          </select>
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm">
          {/*
            Default checked. The common case is billable, and an
            unticked box that silently means "free" is how work ends
            up uncharged by accident.
          */}
          <input
            type="checkbox"
            name="billable"
            defaultChecked
            className="h-4 w-4"
          />
          Bill this
        </label>

        <div className="min-w-[200px] flex-1">
          <label htmlFor="exclusionReason" className={label}>
            If not billing, why
          </label>
          <input
            id="exclusionReason"
            name="exclusionReason"
            type="text"
            maxLength={120}
            placeholder="Shown to the client as work done and not charged."
            className={field}
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#D828A0" }}
        >
          {isPending ? "Logging…" : "Log time"}
        </Button>
      </div>

      {state && (
        <p
          className="mt-3 text-sm"
          style={{ color: state.ok ? "#007048" : "#d84343" }}
        >
          {state.message}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        Quarter hours only. Marked estimates carry an asterisk on the
        client&apos;s copy rather than being passed off as measured.
      </p>
    </form>
  );
}
