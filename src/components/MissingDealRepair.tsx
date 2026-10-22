"use client";
import { Button } from "@/components/Button";

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
import {
  createMissingEngagementDeal,
  linkExistingEngagementDeal,
} from "@/lib/engagement-actions";

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

  // Separate action, separate pending state. Creating a deal and
  // attaching one that exists are different decisions, and a shared
  // spinner would make the wrong one look busy.
  const [linkState, linkAction, linkPending] = useActionState<
    { ok: boolean; message: string } | null,
    FormData
  >(async (prev, formData) => linkExistingEngagementDeal(prev, formData), null);

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
      {linkState && (
        <p
          className={`mt-3 text-xs ${linkState.ok ? "text-[#13A06A]" : "text-brand-magentaText"}`}
        >
          {linkState.message}
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
            <Button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-full border border-brand-magenta/50 px-4 py-1.5 text-xs text-brand-magentaText hover:border-brand-magenta disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create the deal"}
            </Button>
          </form>
        ))}
      </div>

      {/* The other half. Creating a second deal for work that already
          has one splits the revenue across two records in HubSpot,
          and the error shows up as a number that looks plausible
          rather than as a failure. */}
      <div className="mt-4 border-t border-[var(--surface-border)] pt-4">
        <p className="text-xs text-ink-muted">
          Already made it in HubSpot? Attach that one instead — paste the
          deal link or its id.
        </p>
        <div className="mt-2 space-y-2">
          {engagements.map((e) => (
            <form
              key={`link:${e.id}`}
              action={linkAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="projectId" value={e.id} />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">
                {e.title}
              </span>
              <input
                name="hubspotDeal"
                placeholder="app.hubspot.com/…/record/0-3/123…"
                disabled={linkPending}
                className="w-full min-w-0 flex-[2] rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60 md:w-auto"
              />
              <Button
                type="submit"
                disabled={linkPending}
                className="shrink-0 rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs text-ink-muted hover:text-ink disabled:opacity-60"
              >
                {linkPending ? "Checking…" : "Attach"}
              </Button>
            </form>
          ))}
        </div>
      </div>
    </section>
  );
}
