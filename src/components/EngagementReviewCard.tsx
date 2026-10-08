"use client";

/**
 * The Builder's one screen.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-08)
 *
 * This is the whole of the Builder's side of the direct motion, and it
 * exists because the alternative was FM committing their hours, at a
 * rate they had not confirmed, to a ceiling they had never seen.
 *
 * It asks for nothing. No form to fill in, no rate to negotiate in a
 * text field, no counter-offer flow. Read the terms, Accept, or Decline
 * and say what is wrong. A counter-offer is a conversation, and the
 * admin who typed the terms is one message away.
 *
 * WHY DECLINE ASKS FOR A REASON AND ACCEPT DOES NOT
 *
 * An acceptance needs no explanation. A decline is the only signal
 * that the terms were wrong, and without it the admin knows the deal
 * stalled and nothing about why. Usually it is the ceiling, which on
 * this first real engagement nobody could have known in advance.
 * ─────────────────────────────────────────────────────────────
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  decideEngagementTerms,
  type EngagementDecisionResult,
} from "@/lib/engagement-actions";
import { formatFileSize } from "@/lib/engagement-reference-limits";

export interface EngagementReviewProps {
  projectId: string;
  title: string;
  clientDisplayName: string;
  scope: string;
  basis: "hourly" | "fixed";
  /** What the Builder is paid. Never the client rate. */
  payout: string;
  ceilingHours: string | null;
  links: { label: string; url: string }[];
  files: { name: string; sizeBytes: number }[];
  sentAt: string | null;
}

export function EngagementReviewCard(props: EngagementReviewProps) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  const [state, action, pending] = useActionState<
    EngagementDecisionResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await decideEngagementTerms(prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, null);

  const label = "text-[11px] uppercase tracking-wider text-ink-muted";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="projectId" value={props.projectId} />

      {state && !state.ok && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/5 px-4 py-3 text-xs text-ink">
          {state.error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <p className={label}>{props.clientDisplayName}</p>
        <h1 className="mt-1 text-2xl font-semibold">{props.title}</h1>
        <p className="mt-3 whitespace-pre-line text-sm text-ink-muted">
          {props.scope}
        </p>
      </div>

      {/* ── terms ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <p className={label}>Your terms</p>
        <div className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <p className="text-2xl font-semibold">
              ${props.payout}
              {props.basis === "hourly" && (
                <span className="text-sm font-normal text-ink-muted">/hr</span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {props.basis === "hourly" ? "Paid to you, hourly" : "Paid to you, fixed"}
            </p>
          </div>
          {props.basis === "hourly" && (
            <div>
              <p className="text-2xl font-semibold">
                {props.ceilingHours ?? "Open"}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                {props.ceilingHours
                  ? "Hours not to exceed. Bill what you use."
                  : "No cap set. Decline and name one if you want it fixed."}
              </p>
            </div>
          )}
        </div>
        {props.basis === "hourly" && props.ceilingHours && (
          <p className="mt-4 text-[11px] text-ink-faint">
            A cap, not an estimate. Come in under it and you bill what you
            used. Tell us before you approach it.
          </p>
        )}
      </div>

      {/* ── references ─────────────────────────────────────── */}
      {(props.links.length > 0 || props.files.length > 0) && (
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
          <p className={label}>What you are working from</p>
          <ul className="mt-3 space-y-1.5">
            {props.links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-sm text-brand-magentaText hover:underline"
                >
                  {l.label}
                </a>
                <span className="ml-2 text-[10px] text-ink-faint">
                  live document
                </span>
              </li>
            ))}
            {props.files.map((f, i) => (
              <li key={`${f.name}:${i}`}>
                <a
                  href={`/api/engagements/${props.projectId}/attachments/${i}`}
                  className="text-sm text-brand-magentaText hover:underline"
                >
                  {f.name}
                </a>
                <span className="ml-2 text-[10px] text-ink-faint">
                  {formatFileSize(f.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── decision ───────────────────────────────────────── */}
      {!declining ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="decision"
            value="accept"
            disabled={pending}
            className="fm-btn-primary rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Accepting…" : "Accept these terms"}
          </button>
          <button
            type="button"
            onClick={() => setDeclining(true)}
            disabled={pending}
            className="rounded-full border border-[var(--surface-border)] px-6 py-2.5 text-sm text-ink-muted hover:text-ink disabled:opacity-60"
          >
            Something is wrong
          </button>
          <span className="text-[11px] text-ink-faint">
            Accepting starts the work. The client has not been told anything
            yet.
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
          <p className={label}>What needs to change</p>
          <textarea
            name="declineReason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The rate, the hours, the timing, the scope. A sentence is enough."
            className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none"
            disabled={pending}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              name="decision"
              value="decline"
              disabled={pending || reason.trim().length < 3}
              className="rounded-full border border-red-500/60 px-6 py-2.5 text-sm text-ink disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send this back"}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              disabled={pending}
              className="text-[11px] text-ink-faint hover:text-ink"
            >
              Never mind
            </button>
            <span className="text-[11px] text-ink-faint">
              Goes to whoever composed it. Nothing is said to the client.
            </span>
          </div>
        </div>
      )}
    </form>
  );
}
