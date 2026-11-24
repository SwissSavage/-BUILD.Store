/**
 * One rating question: half-stars, and the reason a sub-maximum score
 * owes.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY ONE COMPONENT FOR ALL THREE FORMS (2026-11-24)
 *
 * Peer review, admin review and client feedback each had their own
 * star markup and their own idea of what a valid answer was. Three
 * copies of a scale is three places to change it and three chances for
 * them to drift, and the drift lands on a payout now that these feed
 * the Bonus Margin.
 *
 * So the scale, the skip affordance, the anchor text and the reason box
 * are here once. A form supplies the question and the example; it does
 * not get to invent the mechanics.
 *
 * ─────────────────────────────────────────────────────────────
 * THE REASON BOX APPEARS, IT IS NOT ALWAYS THERE
 *
 * It opens when the score drops below the maximum, with the rule said
 * plainly next to it: if you cannot name what would have been better,
 * the score should be higher. Showing it up front on every question
 * teaches people to pad; showing it on demand makes the cost of a
 * middling score legible at the moment they choose one.
 *
 * Skipping asks for nothing. Null is "did not answer" and the
 * aggregate ignores it, which is different from a low score and must
 * stay different — a reviewer with no view on scope clarity should be
 * able to say so in one click without owing an essay.
 *
 * Presentational only. Everything arrives as a prop, nothing here
 * reaches the database, and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useState } from "react";
import {
  HALF_STEPS,
  HALF_STEP_MAX,
  REASON_MIN_LENGTH,
  formatStars,
} from "@/lib/ratings";

export function HalfStarField({
  name,
  label,
  question,
  example,
  defaultValue = null,
}: {
  /** Form field name. The reason posts as `${name}__reason`. */
  name: string;
  label: string;
  question: string;
  /** What a top and a middling score actually look like. */
  example?: string;
  defaultValue?: number | null;
}) {
  const [value, setValue] = useState<number | null>(defaultValue);
  const [reason, setReason] = useState("");

  const owesReason = value !== null && value < HALF_STEP_MAX;
  const short = owesReason && reason.trim().length < REASON_MIN_LENGTH;

  return (
    <div className="rounded-xl border border-[var(--surface-border)] p-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">
          {label}
        </span>
        <span className="text-[11px] text-ink-faint">{question}</span>
      </div>
      {example && (
        <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
          {example}
        </p>
      )}

      {/*
        Half-steps rather than five buttons. 3.5 is a real grade and
        the thing people most often mean, and rounding it away was
        costing the scale most of its resolution.
      */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {HALF_STEPS.map((hs) => (
          <label
            key={hs}
            className="cursor-pointer rounded-md border border-[var(--surface-border)] px-2 py-1 text-xs tabular-nums hover:border-brand-magenta has-[:checked]:border-brand-magenta has-[:checked]:text-brand-magentaText"
          >
            <input
              type="radio"
              name={name}
              value={hs}
              checked={value === hs}
              onChange={() => setValue(hs)}
              className="sr-only"
            />
            {formatStars(hs)}
          </label>
        ))}
        <label className="ml-1 cursor-pointer text-[11px] text-ink-faint hover:text-ink-muted">
          <input
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={() => setValue(null)}
            className="sr-only"
          />
          skip
        </label>
      </div>

      {owesReason && (
        <div className="mt-2">
          <label
            htmlFor={`${name}__reason`}
            className="block text-[11px] text-ink-muted"
          >
            What would have been better?
          </label>
          <textarea
            id={`${name}__reason`}
            name={`${name}__reason`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Name the specific thing. One sentence is enough."
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          />
          <p
            className="mt-0.5 text-[11px]"
            style={{ color: short ? "#B4740F" : "var(--ink-faint)" }}
          >
            {short
              ? "Required below the top score. If you cannot name it, score it higher — or skip the question."
              : "Recorded with the rating. The person sees this; they never see who wrote it."}
          </p>
        </div>
      )}
    </div>
  );
}
