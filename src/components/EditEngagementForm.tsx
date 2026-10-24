"use client";
import { Button } from "@/components/Button";

/**
 * Change an engagement after it has been sent.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-14)
 *
 * The composer could create an engagement and the Builder could accept
 * it, and after that nothing could be changed except by having them
 * decline. The ceiling is deliberately left blank until the Builder
 * says how long the work takes, so the normal next step had no route.
 *
 * This screen is deliberately blunt about consequence. When the
 * engagement is already accepted, changing a term sends it back for
 * re-acceptance, and the form says so before you touch anything rather
 * than after you save.
 * ─────────────────────────────────────────────────────────────
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateEngagement,
  type UpdateEngagementResult,
} from "@/lib/engagement-actions";
import { EngagementReferencesField } from "@/components/EngagementReferencesField";
import { formatFileSize } from "@/lib/engagement-reference-limits";

export interface EditEngagementProps {
  projectId: string;
  title: string;
  scope: string;
  basis: "hourly" | "fixed";
  clientRate: string;
  ceilingHours: string | null;
  state: "awaiting_talent" | "accepted";
  clientDisplayName: string;
  existingFiles: { name: string; sizeBytes: number }[];
}

export function EditEngagementForm(props: EditEngagementProps) {
  const router = useRouter();
  const [basis, setBasis] = useState(props.basis);
  const [rate, setRate] = useState(props.clientRate);
  const [ceiling, setCeiling] = useState(props.ceilingHours ?? "");
  const [scope, setScope] = useState(props.scope);

  const [state, action, pending] = useActionState<
    UpdateEngagementResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await updateEngagement(prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, null);

  // Mirrors what the server treats as a term change, so the warning on
  // screen matches the consequence the save will actually have.
  const termsTouched =
    basis !== props.basis ||
    rate.trim() !== props.clientRate ||
    ceiling.trim() !== (props.ceilingHours ?? "") ||
    scope !== props.scope;

  const willGoBack = props.state === "accepted" && termsTouched;

  const field =
    "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60";
  const label = "text-[11px] uppercase tracking-wider text-ink-muted";

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="projectId" value={props.projectId} />

      {state && !state.ok && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/5 px-4 py-3 text-xs text-ink">
          {state.error}
        </div>
      )}
      {state && state.ok && (
        <div className="rounded-xl border border-[#13A06A]/50 bg-[#13A06A]/5 px-4 py-3 text-xs text-ink">
          {state.message}
        </div>
      )}

      {willGoBack && (
        <div className="rounded-xl border border-[#D828A0]/50 bg-[#D828A0]/5 px-4 py-3 text-xs text-ink">
          This engagement is already accepted. Changing the terms sends it
          back to the Builder to confirm, and work shows as paused until
          they do. Reference material and the name can be changed without
          that.
        </div>
      )}

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
        <p className={label}>{props.clientDisplayName}</p>
        <label className="mt-3 block">
          <span className={label}>Engagement name</span>
          <input
            name="title"
            defaultValue={props.title}
            className={field}
            disabled={pending}
          />
        </label>
        <label className="mt-3 block">
          <span className={label}>Scope</span>
          <textarea
            name="engagementScope"
            rows={4}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={field}
            disabled={pending}
          />
        </label>
      </section>

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

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={label}>Client pays</span>
            <input
              name="engagementRate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={field}
              disabled={pending}
            />
            <span className="mt-1 block text-[10px] text-ink-faint">
              The Builder is paid 85 percent of this, recalculated on save.
            </span>
          </label>
          {basis === "hourly" && (
            <label className="block">
              <span className={label}>Not to exceed (hours)</span>
              <input
                name="engagementCeilingHours"
                inputMode="decimal"
                value={ceiling}
                onChange={(e) => setCeiling(e.target.value)}
                placeholder="Blank means no cap"
                className={field}
                disabled={pending}
              />
              {/* The reason this screen exists. An accepted hourly
                  engagement with no cap is the exact gap the ceiling
                  was introduced to close. */}
              {!props.ceilingHours && (
                <span className="mt-1 block text-[10px] text-brand-magentaText">
                  Currently no cap of record. Whatever hours were agreed
                  verbally are not written down anywhere.
                </span>
              )}
            </label>
          )}
        </div>
      </section>

      {/* ── references ─────────────────────────────────────── */}
      {props.existingFiles.length > 0 && (
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
          <p className={label}>Attached now</p>
          <ul className="mt-2 space-y-1">
            {props.existingFiles.map((f, i) => (
              <li
                key={`${f.name}:${i}`}
                className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-1.5 text-xs"
              >
                <span className="truncate">{f.name}</span>
                <span className="ml-3 shrink-0 text-ink-faint">
                  {formatFileSize(f.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-ink-faint">
            Attaching files below replaces this list. Leave the file picker
            alone to keep these as they are.
          </p>
        </section>
      )}

      <EngagementReferencesField disabled={pending} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="fm-btn-primary rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : willGoBack
              ? "Save and send back for confirmation"
              : "Save changes"}
        </Button>
        <span className="text-[11px] text-ink-faint">
          {willGoBack
            ? "The Builder confirms the new terms before work resumes."
            : props.state === "accepted"
              ? "Material and naming only. Terms are unchanged."
              : "The Builder has not responded yet, so this just updates what they will see."}
        </span>
      </div>
    </form>
  );
}
