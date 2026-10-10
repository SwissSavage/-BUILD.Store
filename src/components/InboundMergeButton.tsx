"use client";

/**
 * Merge open applications with accounts that already exist.
 *
 * Going forward, accepting an invite closes out the applicant's own
 * form submission automatically. This is for the ones already in the
 * queue when that landed, and for the reverse order: someone applies
 * today who was invited and signed up last week.
 *
 * A button rather than something that runs on page load, so an admin
 * is told what moved instead of finding the queue different.
 */

import { useActionState } from "react";
import { reconcileInboundAgainstRoster } from "@/lib/inbound-reconcile-actions";

export function InboundMergeButton() {
  const [state, action, pending] = useActionState<
    { ok: boolean; message: string } | null,
    FormData
  >(async () => reconcileInboundAgainstRoster(), null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magentaText disabled:opacity-60"
      >
        {pending ? "Checking…" : "Merge with existing members"}
      </button>
      {state ? (
        <span className="text-[11px] text-ink-muted">{state.message}</span>
      ) : (
        <span className="text-[11px] text-ink-faint">
          Closes out applications from people who already have an account.
        </span>
      )}
    </form>
  );
}
