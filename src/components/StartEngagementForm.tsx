"use client";

/**
 * One screen: client, Builder, terms, references. Save and the terms go
 * to the Builder.
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
 * WHY THE BUTTON SENDS RATHER THAN STARTS
 *
 * It used to say "Start engagement" and it meant it: deal created,
 * project running, Builder notified, in one press, off terms the
 * Builder had never seen. Jamar: "I don't think a raw hot start should
 * be an option. That leaves open principal agent problems and all
 * that's needed really is one review and click from talent."
 *
 * So there is one button and it sends. The admin still does all the
 * typing; the Builder reads one screen and clicks once.
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
  composeEngagement,
  type ComposeEngagementResult,
} from "@/lib/engagement-actions";
import {
  suggestedBuilderHourlyPayout,
  suggestedClientHourlyRate,
} from "@/lib/quote-pricing";
import { EngagementReferencesField } from "@/components/EngagementReferencesField";

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
  const [ask, setAsk] = useState("");
  const [talentId, setTalentId] = useState("");
  const [newClient, setNewClient] = useState(false);

  const [state, action, pending] = useActionState<
    ComposeEngagementResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await composeEngagement(prev, formData);
    if (result.ok) router.push(`/projects/${result.projectId}`);
    return result;
  }, null);

  // The whole chain, shown live, because "Client rate" next to "Builder
  // asks" read as though the second was free to be anything and then
  // the server refused $65 against a $55 ask with no explanation of
  // where $77 came from. Same arithmetic the server applies.
  const askNum = Number(ask.replace(/[$,\s]/g, ""));
  const hasAsk = Number.isFinite(askNum) && askNum > 0;
  const paid = hasAsk ? suggestedBuilderHourlyPayout(askNum) : null;
  const floor = hasAsk ? suggestedClientHourlyRate(askNum) : null;

  const selectedTalent = talent.find((t) => t.id === talentId);
  const firstName = selectedTalent?.name.split(" ")[0] ?? "the Builder";

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
              <span className={label}>HubSpot company (optional)</span>
              <input
                name="hubspotCompanyId"
                placeholder="Paste the record URL or the id"
                className={field}
                disabled={pending}
              />
              {/* Pasting the address bar is the normal thing to do and
                  used to produce a client row silently unlinked from
                  the CRM. The id is now pulled out of the URL. */}
              <span className="mt-1 block text-[10px] text-ink-faint">
                The browser URL works. The company name in HubSpot wins over
                what you type above.
              </span>
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
            <select
              name="talentUserId"
              value={talentId}
              onChange={(e) => setTalentId(e.target.value)}
              className={field}
              disabled={pending}
            >
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

      {/* ── references ─────────────────────────────────────── */}
      <EngagementReferencesField disabled={pending} />

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
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className={label}>{firstName} asks</span>
                <input
                  name="builderPayoutRate"
                  inputMode="decimal"
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder="per hour"
                  className={field}
                  disabled={pending}
                />
              </label>
              <label className="block">
                <span className={label}>Client pays</span>
                <input
                  name="engagementRate"
                  inputMode="decimal"
                  placeholder={floor ? `${floor}` : "per hour"}
                  className={field}
                  disabled={pending}
                />
                <span className="mt-1 block text-[10px] text-ink-faint">
                  {floor
                    ? `Blank uses $${floor}. Above it is yours to charge; below it is refused.`
                    : "Set by the standing rules once an ask is entered."}
                </span>
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
                {/* The lever. A ceiling commits to nothing about how
                    long the work takes, which is what stopped two
                    previous renegotiations from being necessary. */}
                <span className="mt-1 block text-[10px] text-ink-faint">
                  A cap, not an estimate. Bill what is used. Leave it blank and
                  the Builder proposes one.
                </span>
              </label>
            </div>

            {/* The chain, in order, so the refusal is never a surprise. */}
            {hasAsk && paid && floor && (
              <p className="mt-3 rounded-lg bg-[var(--surface-raised)] px-3 py-2 text-[11px] text-ink-muted">
                {firstName} asks <strong className="text-ink">${askNum}</strong>{" "}
                · paid <strong className="text-ink">${paid}</strong> (the $10
                over their ask, floor of $50) · client pays{" "}
                <strong className="text-ink">${floor}</strong> (that payout at
                the cooperative&rsquo;s 85 percent)
              </p>
            )}
          </>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className={label}>Fixed price</span>
              <input
                name="engagementRate"
                inputMode="decimal"
                placeholder="Total the client pays"
                className={field}
                disabled={pending}
              />
            </label>
            <label className="block">
              <span className={label}>{firstName} is paid</span>
              <input
                name="builderPayoutRate"
                inputMode="decimal"
                placeholder="Their share of it"
                className={field}
                disabled={pending}
              />
            </label>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="fm-btn-primary rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {pending
            ? "Sending…"
            : selectedTalent
              ? `Send to ${firstName} for review`
              : "Send for review"}
        </button>
        <span className="text-[11px] text-ink-faint">
          {firstName} reads the terms and accepts or declines. Nothing is
          created in HubSpot and nothing is said to the client until they
          accept.
        </span>
      </div>
    </form>
  );
}
