"use client";

/**
 * Accepted engagements with no HubSpot deal behind them.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-09)
 *
 * Deal creation at acceptance is best-effort on purpose: a CRM outage
 * must not stop agreed work from starting. The cost of that choice is
 * that an engagement can run with no deal, and the first one did. The
 * only reason anybody found out was Jamar opening HubSpot and not
 * seeing it there.
 *
 * Best-effort is still right. Silent is not. This is the other half:
 * the gap is listed where contracts are read, with the fix one click
 * away, so a swallowed error stays visible until someone deals with it.
 * ─────────────────────────────────────────────────────────────
 */

import { useActionState } from "react";
import { createMissingEngagementDeal } from "@/lib/engagement-actions";

export interface MissingDeal {
  id: string;
  title: string;
  clientDisplayName: string;
}

export function MissingDealRepair({ engagements }: { engagements: MissingDeal[] }) {
  const [state, action, pending] = useActionState<
    { ok: boolean; message: string } | null,
    FormData
  >(async (prev, formData) => createMissingEngagementDeal(prev, formData), null);

  if (engagements.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-[#D828A0]/50 bg-[#D828A0]/5 p-5">
      <p className="text-[11px] uppercase tracking-wider text-brand-magentaText">
        Not in HubSpot
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Accepted and running, with no deal behind it. The work is recorded
        here either way; the CRM does not know about the revenue.
      </p>

      {state && (
        <p
          className={`mt-3 text-xs ${state.ok ? "text-[#13A06A]" : "text-brand-magentaText"}`}
        >
          {state.message}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {engagements.map((e) => (
          <form
            key={e.id}
            action={action}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3"
          >
            <input type="hidden" name="projectId" value={e.id} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{e.title}</p>
              <p className="text-xs text-ink-muted">{e.clientDisplayName}</p>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-full border border-brand-magenta/50 px-4 py-1.5 text-xs text-brand-magentaText hover:border-brand-magenta disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create the deal"}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
