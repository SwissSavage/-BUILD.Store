"use client";

/**
 * The four numbers behind one Builder's line, live.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-24)
 *
 * #209 asks that an admin see submitted ask, payout basis, client
 * price and the Future Modern amount together, and that changing the
 * client price recalculate the margin immediately.
 *
 * The composer previously showed three of the four in a sentence and
 * never showed the margin. The override box was an uncontrolled input
 * next to static text, so typing a new rate changed nothing on screen
 * until you saved and reloaded — Jamar, on being told that: "I don't
 * know what you mean by 2." Which is fair, because from the outside it
 * looks like it already works.
 *
 * So the field owns state and the numbers recompute as you type. The
 * arithmetic is builderPriceBreakdown from quote-pricing, the same
 * function the server uses, rather than a second copy that agrees
 * today and drifts next quarter.
 *
 * DISPLAY ONLY. The server recomputes this before writing anything.
 * A number typed into a form is a suggestion until the server has
 * agreed with it.
 *
 * WHY EACH NUMBER IS LABELLED BY ORIGIN
 *
 * An ask and an override look identical once they are both numbers on
 * a screen, and they carry completely different weight in a
 * renegotiation. "They asked for this" is their position. "We decided
 * this" is ours. The whole point of showing the breakdown is keeping
 * those apart.
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import {
  builderPriceBreakdown,
  formatUsdCents,
} from "@/lib/quote-pricing";

export interface BuilderPriceBreakdownProps {
  /** Form field name, so the server still reads the override. */
  fieldName: string;
  priceMode: string | null;
  hourlyRate: string | null;
  hourlyRateMax: string | null;
  fixedPriceMin: string | null;
  fixedPriceMax?: string | null;
  /** Whatever is already saved on the draft, if anything. */
  initialOverride?: string;
  /** Set when an admin, not the Builder, entered the submitted range. */
  rangeSetByAdmin?: boolean;
}

export function BuilderPriceBreakdown(props: BuilderPriceBreakdownProps) {
  const [override, setOverride] = useState(props.initialOverride ?? "");

  const typed = Number(override);
  const b = builderPriceBreakdown({
    priceMode: props.priceMode,
    hourlyRate: props.hourlyRate,
    hourlyRateMax: props.hourlyRateMax,
    fixedPriceMin: props.fixedPriceMin,
    fixedPriceMax: props.fixedPriceMax,
    overrideClientPrice: Number.isFinite(typed) && typed > 0 ? typed : null,
  });

  const unit = b.perHour ? "/hr" : "";
  const submitted =
    b.submittedMax !== null
      ? `${formatUsdCents(b.submittedMin)}–${formatUsdCents(b.submittedMax)}${unit}`
      : `${formatUsdCents(b.submittedMin)}${unit}`;

  // Below the payout there is no margin at all, which is a refusal on
  // the server. Said here so it is visible before submitting.
  const belowPayout = b.finalClientPrice > 0 && b.adminAmount <= 0;

  const row = "flex items-baseline justify-between gap-3 py-1";
  const key = "text-[10px] uppercase tracking-wider text-ink-muted";
  const val = "text-xs font-medium tabular-nums";

  return (
    <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
      <div className={row}>
        <span className={key}>
          {props.rangeSetByAdmin ? "Admin-set ask" : "Builder submitted"}
        </span>
        <span className={val}>{submitted}</span>
      </div>

      <div className={row}>
        <span className={key}>
          Builder is paid
          {b.payoutLiftedByRule && (
            <span className="ml-1 normal-case tracking-normal text-ink-faint">
              (lifted by the floor/hedge)
            </span>
          )}
        </span>
        <span className={val}>
          {formatUsdCents(b.payoutBasis)}
          {unit}
        </span>
      </div>

      <label className="mt-2 block">
        <span className={key}>
          Client pays{" "}
          <span className="normal-case tracking-normal text-ink-faint">
            {b.clientPriceOverridden
              ? "(admin-set)"
              : `(suggested ${formatUsdCents(b.suggestedClientPrice)}${unit})`}
          </span>
        </span>
        <input
          name={props.fieldName}
          inputMode="decimal"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder={`${formatUsdCents(b.suggestedClientPrice)}${unit}`}
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs tabular-nums"
        />
      </label>

      <div
        className={`${row} mt-2 border-t border-[var(--surface-border)] pt-2`}
      >
        <span className={key}>Future Modern keeps</span>
        <span
          className={val}
          style={{ color: belowPayout ? "var(--fm-magenta-text)" : undefined }}
        >
          {formatUsdCents(b.adminAmount)}
          {unit}
        </span>
      </div>

      {belowPayout && (
        <p className="mt-2 text-[10px] text-brand-magentaText">
          At or below what the Builder is paid. The server refuses this —
          the cooperative would be funding the engagement.
        </p>
      )}
    </div>
  );
}
