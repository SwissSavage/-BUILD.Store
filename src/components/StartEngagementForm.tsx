"use client";

/**
 * One screen: client, Builder, terms, scope. Save and the engagement
 * exists.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-08)
 *
 * Starting work meant posting an RFP, dispatching it, collecting bids
 * and compiling a quote, for a returning client who already knows who
 * they want and what it costs. The real motion is a deal, a stage of
 * closed-won, and work starting. This records that motion rather than
 * replacing it.
 *
 * useActionState and a returned result, not a throw. Next redacts
 * server action errors in production and re-renders the page from
 * server state, which on a form this long means everything typed is
 * gone. That happened on the quote compiler and cost an afternoon.
 * ─────────────────────────────────────────────────────────────
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startDirectEngagement,
  type StartEngagementResult,
} from "@/lib/engagement-actions";
import { suggestedClientHourlyRate } from "@/lib/quote-pricing";

export interface EngagementFormClient {
  id: string;
  displayName: string;
}

export interface EngagementFormTalent {
  id: string;
  name: string;
  discipline: string | null;
}

export function StartEngagementForm({
  clients,
  talent,
  industries,
}: {
  clients: EngagementFormClient[];
  talent: EngagementFormTalent[];
  industries: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [basis, setBasis] = useState<"hourly" | "fixed">("hourly");
  const [payout, setPayout] = useState("");
  const [newClient, setNewClient] = useState(false);

  const [state, action, pending] = useActionState<
    StartEngagementResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await startDirectEngagement(prev, formData);
    if (result.ok) router.push(`/projects/${result.projectId}`);
    return result;
  }, null);

  // Shown live so an admin sees what the standing rules produce before
  // deciding whether to charge above it. Same arithmetic the server
  // applies, so the number on screen is the number that gets used.
  const payoutNum = Number(payout.replace(/[$,\s]/g, ""));
  const suggested =
    Number.isFinite(payoutNum) && payoutNum > 0
      ? suggestedClientHourlyRate(payoutNum)
      : null;

  const field =
    "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60";
  const label = "text-[11px] uppercase tracking-wider text-ink-muted";

  return (
    <form action={action} className="space-y-6">
      {state && !state.ok && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/5 px-4 py-3 text-xs text-ink">
          {state.error}
        </div>
      )}

      {/* ── client ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
        <p className={label}>Client</p>
        {!newClient ? (
          <>
            <label className="mt-3 block">
              <span className={label}>Existing client</span>
              <select name="clientId" className={field} disabled={pending}>
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setNewClient(true)}
              className="mt-2 text-[11px] text-brand-magentaText hover:underline"
            >
              Not listed? Add them
            </button>
          </>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className={label}>Company</span>
              <input
                name="clientDisplayName"
                placeholder="As they write it themselves"
                className={field}
                disabled={pending}
              />
            </label>
            <label className="block">
              <span className={label}>HubSpot company id (optional)</span>
              <input
                name="hubspotCompanyId"
                placeholder="Links to the CRM record"
                className={field}
                disabled={pending}
              />
            </label>
            <label className="block">
              <span className={label}>Contact name</span>
              <input name="clientContactName" className={field} disabled={pending} />
            </label>
            <label className="block">
              <span className={label}>Contact email</span>
              <input
                name="clientContactEmail"
                type="email"
                className={field}
                disabled={pending}
              />
            </label>
            <button
              type="button"
              onClick={() => setNewClient(false)}
              className="text-left text-[11px] text-brand-magentaText hover:underline"
            >
              Pick an existing client instead
            </button>
          </div>
        )}
      </section>

      {/* ── who and what ───────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
        <p className={label}>The work</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={label}>Builder</span>
            <select name="talentUserId" className={field} disabled={pending}>
              <option value="">Select a Builder</option>
              {talent.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.discipline ? ` · ${t.discipline}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Pillar</span>
            <select name="industry" className={field} disabled={pending}>
              {industries.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className={label}>Engagement name</span>
          <input
            name="title"
            placeholder="What the client would call this"
            className={field}
            disabled={pending}
          />
        </label>
        <label className="mt-3 block">
          <span className={label}>Scope</span>
          <textarea
            name="engagementScope"
            rows={4}
            placeholder="A line or two. This is what the agreement is generated from."
            className={field}
            disabled={pending}
          />
        </label>
      </section>

      {/* ── terms ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
        <p className={label}>Terms</p>
        <div className="mt-3 flex gap-4">
          {(["hourly", "fixed"] as const).map((b) => (
            <label key={b} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="engagementBasis"
                value={b}
                checked={basis === b}
                onChange={() => setBasis(b)}
                disabled={pending}
              />
              {b === "hourly" ? "Hourly" : "Fixed price"}
            </label>
          ))}
        </div>

        {basis === "hourly" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className={label}>Builder asks</span>
              <input
                name="builderPayoutRate"
                inputMode="decimal"
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                placeholder="per hour"
                className={field}
                disabled={pending}
              />
            </label>
            <label className="block">
              <span className={label}>Client rate</span>
              <input
                name="engagementRate"
                inputMode="decimal"
                placeholder={suggested ? `Default $${suggested}` : "per hour"}
                className={field}
                disabled={pending}
              />
              {suggested && (
                <span className="mt-1 block text-[10px] text-ink-faint">
                  Rules give ${suggested}/hr. Blank uses that; below it is
                  refused.
                </span>
              )}
            </label>
            <label className="block">
              <span className={label}>Not to exceed (hours)</span>
              <input
                name="engagementCeilingHours"
                inputMode="decimal"
                placeholder="Optional"
                className={field}
                disabled={pending}
              />
              {/* The lever. A ceiling commits to nothing about how long
                  the work takes, which is what stopped two previous
                  renegotiations from being necessary. */}
              <span className="mt-1 block text-[10px] text-ink-faint">
                A cap, not an estimate. Bill what is used.
              </span>
            </label>
          </div>
        ) : (
          <label className="mt-3 block md:w-1/3">
            <span className={label}>Fixed price</span>
            <input
              name="engagementRate"
              inputMode="decimal"
              placeholder="Total"
              className={field}
              disabled={pending}
            />
          </label>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="fm-btn-primary rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Starting…" : "Start engagement"}
        </button>
        <span className="text-[11px] text-ink-faint">
          Creates the engagement, the HubSpot deal, and assigns the Builder.
          The agreement is generated from this.
        </span>
      </div>
    </form>
  );
}
