/**
 * Display + aggregation helpers for the CooperativeQuote per-Builder
 * pricing model.
 *
 * Each proposed Builder carries their own pricing discriminated union:
 *   - fixed  : single total contract value in USD
 *   - range  : min/max bracket in USD
 *   - hourly : hourly rate in USD (open-ended, billed as delivered)
 *
 * Aggregate quote total is derived from the set of picked Builders
 * (`deriveAggregatePricing`). This canonizes Jamar's Google Doc
 * quote-sheet math: per-provider quotes summed into the engagement
 * total, adjusted as the client trims the hand.
 *
 * The 85/15 split math applies per-Builder — each Builder's slice
 * carries the standard talent/operations breakdown so the client
 * surface can show what each Builder receives directly + what feeds
 * the cooperative on that Builder's engagement.
 *
 * All formatting uses en-US USD with no fraction digits for whole
 * dollars and 2 fraction digits for the hourly rate variants where the
 * split can produce cents (e.g. $150/hr * 0.85 = $127.50/hr).
 */

import type {
  CooperativeQuotePricing,
  ProposedBuilder,
} from "@/lib/types";

/**
 * Format USD, retaining cents when a contributor proposes them.
 */
export function formatUsd(amount: number): string {
  return formatUsdCents(amount);
}

/**
 * Format an amount that may include cents (for hourly-rate splits).
 * Trims trailing .00 so whole-dollar rates stay clean.
 */
export function formatUsdCents(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const isWhole = Math.abs(rounded - Math.trunc(rounded)) < 0.005;
  return isWhole
    ? `$${Math.trunc(rounded).toLocaleString("en-US")}`
    : `$${rounded.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

/**
 * Converts a builder's requested payout to the price presented to the
 * client. The payout must remain 85% of the final client amount; the
 * remainder funds cooperative operations. Round upward so the payout is
 * never reduced by a fractional-cent calculation.
 */
export function clientPricingFromBuilderPayout(
  pricing: CooperativeQuotePricing,
): CooperativeQuotePricing {
  const grossUp = (amount: number) => Math.ceil(amount / 0.85);
  switch (pricing.type) {
    case "fixed":
      return { ...pricing, baseAmount: grossUp(pricing.baseAmount) };
    case "range":
      return {
        ...pricing,
        baseAmountMin: grossUp(pricing.baseAmountMin),
        baseAmountMax: grossUp(pricing.baseAmountMax),
      };
    case "hourly":
      return { ...pricing, hourlyRate: grossUp(pricing.hourlyRate) };
    case "negotiable":
      // No numeric payout exists to gross up. The client-facing quote
      // keeps this as negotiable until an admin supplies a price.
      return pricing;
  }
}

/**
 * Big headline copy that goes at the top of a per-Builder pricing
 * block.
 *   - fixed  : "$25,000"
 *   - range  : "$15,000 to $25,000" (avoids the em-dash range operator)
 *   - hourly : "$150/hr"
 */
export function pricingHeadline(pricing: CooperativeQuotePricing): string {
  switch (pricing.type) {
    case "fixed":
      return `${pricing.minimumOnly ? "From " : ""}${formatUsd(pricing.baseAmount)}`;
    case "range":
      return `${formatUsd(pricing.baseAmountMin)} to ${formatUsd(pricing.baseAmountMax)}`;
    case "hourly":
      return `${pricing.minimumOnly ? "From " : ""}${formatUsd(pricing.hourlyRate)}${pricing.hourlyRateMax && pricing.hourlyRateMax > pricing.hourlyRate ? `–${formatUsd(pricing.hourlyRateMax)}` : ""}/hr`;
    case "negotiable":
      return "Price to be agreed";
  }
}

/**
 * Sub-label right after the headline explaining what the number is.
 *   - fixed  : "fixed"
 *   - range  : "range"
 *   - hourly : "hourly, billed as delivered"
 */
export function pricingUnitLabel(pricing: CooperativeQuotePricing): string {
  switch (pricing.type) {
    case "fixed":
      return pricing.minimumOnly ? "minimum total project price" : "fixed total project price";
    case "range":
      return "range";
    case "hourly":
      return pricing.hourlyRateMax && pricing.hourlyRateMax > pricing.hourlyRate ? "hourly range" : "hourly, billed as delivered";
    case "negotiable":
      return "negotiable";
  }
}

/**
 * Amount that flows to the Builder (talent side of the split).
 * Returns a display-formatted string in the correct unit.
 */
export function pricingTalentAmount(
  pricing: CooperativeQuotePricing,
): string {
  const pct = pricing.talentSplit / 100;
  switch (pricing.type) {
    case "fixed":
      return `${pricing.minimumOnly ? "From " : ""}${formatUsd(pricing.baseAmount * pct)}`;
    case "range":
      return `${formatUsd(pricing.baseAmountMin * pct)} to ${formatUsd(pricing.baseAmountMax * pct)}`;
    case "hourly":
      return `${pricing.minimumOnly ? "From " : ""}${formatUsdCents(pricing.hourlyRate * pct)}${pricing.hourlyRateMax && pricing.hourlyRateMax > pricing.hourlyRate ? `–${formatUsdCents(pricing.hourlyRateMax * pct)}` : ""}/hr`;
    case "negotiable":
      return "To be agreed";
  }
}

/**
 * Amount that funds cooperative operations (ops side of the split).
 * Returns a display-formatted string in the correct unit.
 */
export function pricingOperationsAmount(
  pricing: CooperativeQuotePricing,
): string {
  const pct = pricing.operationsSplit / 100;
  switch (pricing.type) {
    case "fixed":
      return `${pricing.minimumOnly ? "From " : ""}${formatUsd(pricing.baseAmount * pct)}`;
    case "range":
      return `${formatUsd(pricing.baseAmountMin * pct)} to ${formatUsd(pricing.baseAmountMax * pct)}`;
    case "hourly":
      return `${pricing.minimumOnly ? "From " : ""}${formatUsdCents(pricing.hourlyRate * pct)}${pricing.hourlyRateMax && pricing.hourlyRateMax > pricing.hourlyRate ? `–${formatUsdCents(pricing.hourlyRateMax * pct)}` : ""}/hr`;
    case "negotiable":
      return "To be agreed";
  }
}

/**
 * Compact one-line summary for admin list views. Uses the headline
 * plus the type label suffix so admins can scan quote types quickly.
 *   - fixed  : "$25,000 fixed"
 *   - range  : "$15,000 to $25,000 range"
 *   - hourly : "$150/hr hourly, billed as delivered"
 */
export function pricingCompactSummary(
  pricing: CooperativeQuotePricing,
): string {
  return `${pricingHeadline(pricing)} ${pricingUnitLabel(pricing)}`;
}

// ──────────────────────────────────────────────────────────────────────
//  Aggregation across a picked hand (Tier 21)
// ──────────────────────────────────────────────────────────────────────

/**
 * Aggregate rollup of per-Builder pricing across a hand. Fixed and
 * range Builders contribute to the same running min/max sum (a fixed
 * value adds equally to both). Hourly Builders can't be summed with
 * fixed totals, so they collect as a separate list of rates and are
 * rendered alongside the numeric total.
 */
export interface AggregateQuotePricing {
  /** True if the hand contains at least one Builder priced fixed or range. */
  hasNumericTotal: boolean;
  /** Sum of low ends across fixed + range Builders (0 if none). */
  totalMin: number;
  /** Sum of high ends across fixed + range Builders (0 if none). */
  totalMax: number;
  /**
   * List of hourly rates on hourly-priced Builders in the hand. These
   * are rendered alongside the numeric total when present because an
   * open-ended hourly engagement cannot be reduced to a fixed sum.
   */
  hourlyRates: string[];
  hasOpenUpperBound: boolean;
  negotiableCount: number;
  /** Count of Builders in the aggregation. */
  builderCount: number;
}

/**
 * Compute the aggregate pricing rollup across a hand of ProposedBuilder
 * rows. Used by the client surface to show the engagement total, and
 * updated live as the client picks / skips cards.
 *
 * Semantics:
 *   - Fixed Builder → adds baseAmount to BOTH totalMin and totalMax.
 *   - Range Builder → adds baseAmountMin to totalMin, baseAmountMax to
 *     totalMax.
 *   - Hourly Builder → contributes to hourlyRates list, does not
 *     participate in the numeric total.
 *
 * If the hand is empty, returns a zero rollup with hasNumericTotal
 * false and no hourly rates.
 */
export function deriveAggregatePricing(
  builders: ProposedBuilder[],
): AggregateQuotePricing {
  let totalMin = 0;
  let totalMax = 0;
  let hasNumericTotal = false;
  let hasOpenUpperBound = false;
  let negotiableCount = 0;
  const hourlyRates: string[] = [];
  for (const b of builders) {
    switch (b.pricing.type) {
      case "fixed":
        totalMin += b.pricing.baseAmount;
        totalMax += b.pricing.baseAmount;
        hasNumericTotal = true;
        hasOpenUpperBound ||= !!b.pricing.minimumOnly;
        break;
      case "range":
        totalMin += b.pricing.baseAmountMin;
        totalMax += b.pricing.baseAmountMax;
        hasNumericTotal = true;
        break;
      case "hourly":
        hourlyRates.push(pricingHeadline(b.pricing));
        break;
      case "negotiable":
        negotiableCount += 1;
        break;
    }
  }
  return {
    hasNumericTotal,
    hasOpenUpperBound,
    negotiableCount,
    totalMin,
    totalMax,
    hourlyRates,
    builderCount: builders.length,
  };
}

/**
 * Render the aggregate as a headline string.
 *   - Empty hand → "No builders selected"
 *   - All fixed, same sum → "$32,000 fixed"
 *   - Mixed fixed + range, min<max → "$38,000 to $52,000"
 *   - Only hourly → "$150/hr and $200/hr"
 *   - Mix of numeric + hourly → "$38,000 to $52,000 plus $150/hr"
 */
export function aggregateHeadline(agg: AggregateQuotePricing): string {
  if (agg.builderCount === 0) return "No builders selected";
  const parts: string[] = [];
  if (agg.hasNumericTotal) {
    if (agg.hasOpenUpperBound) {
      parts.push(`From ${formatUsd(agg.totalMin)} total`);
    } else if (agg.totalMin === agg.totalMax) {
      parts.push(formatUsd(agg.totalMin));
    } else {
      parts.push(`${formatUsd(agg.totalMin)} to ${formatUsd(agg.totalMax)}`);
    }
  }
  if (agg.hourlyRates.length > 0) {
    const rateLabels = agg.hourlyRates;
    const joined =
      rateLabels.length === 1
        ? rateLabels[0]
        : rateLabels.length === 2
          ? `${rateLabels[0]} and ${rateLabels[1]}`
          : `${rateLabels.slice(0, -1).join(", ")}, and ${rateLabels[rateLabels.length - 1]}`;
    parts.push(agg.hasNumericTotal ? `plus ${joined}` : joined);
  }
  if (agg.negotiableCount > 0) {
    parts.push(`${parts.length ? "plus " : ""}${agg.negotiableCount} price${agg.negotiableCount === 1 ? "" : "s"} to be agreed`);
  }
  return parts.join(" ");
}

/**
 * Human unit label for the aggregate. Signals whether the total is
 * fixed or bracketed, and calls out hourly companions.
 */
export function aggregateUnitLabel(agg: AggregateQuotePricing): string {
  if (agg.builderCount === 0) return "";
  if (agg.negotiableCount > 0 && agg.hasNumericTotal) return "priced work plus open terms";
  if (agg.hasOpenUpperBound) return "minimum engagement total";
  if (agg.negotiableCount > 0 && !agg.hasNumericTotal && agg.hourlyRates.length === 0) return "negotiable";
  if (!agg.hasNumericTotal && agg.hourlyRates.length > 0) {
    return "hourly, billed as delivered";
  }
  if (agg.hasNumericTotal && agg.totalMin === agg.totalMax) {
    return "engagement total";
  }
  if (agg.hasNumericTotal) {
    return "expected engagement range";
  }
  return "";
}

/**
 * Cooperative floor and bonus hedge on a Builder's hourly payout.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05, Jamar)
 *
 * Two standing rules, encoded here rather than remembered per quote:
 *
 *   BONUS HEDGE   A Builder who asks for a number gets at least $10/hr
 *                 over it. Members routinely under-ask, and the margin
 *                 funds the bonus gate without renegotiating later.
 *
 *   FLOOR         No Builder is paid under $50/hr through the
 *                 cooperative, whatever they asked for. A member
 *                 bidding $25 is pricing against a market they are
 *                 guessing at; the cooperative does not take the
 *                 discount.
 *
 * Both act on the PAYOUT. The client price is this grossed up by the
 * 85/15 split, which the caller does separately.
 *
 * Not applied to fixed or range bids: a project price is quoted against
 * a scope, and adding $10 to it means nothing.
 * ─────────────────────────────────────────────────────────────
 */
export const BUILDER_HOURLY_FLOOR = 50;
export const BUILDER_BONUS_HEDGE = 10;

/**
 * What a Builder is actually paid per hour, given what they asked.
 *
 * `askMin` is their floor and `askMax` the top of any band they quoted.
 * Three numbers compete and the highest wins:
 *
 *   the rate being taken   a Builder quoting $100 to $175 and taken at
 *                          the top is already $75 above their own
 *                          minimum, so the hedge is satisfied and
 *                          stacking another $10 would be hedging twice
 *
 *   askMin + hedge         a Builder who names one number gets $10 over
 *                          it, because members under-ask and the margin
 *                          funds the bonus gate without a renegotiation
 *
 *   the floor              nobody is paid under $50/hr through the
 *                          cooperative, whatever they asked
 *
 * Reproduces all three live bids: $55 flat becomes $65, $25 flat becomes
 * $50, and $100 to $175 taken at the top stays $175.
 */
export function suggestedBuilderHourlyPayout(
  askMin: number,
  askMax?: number | null,
): number {
  const floorish = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const min = floorish(askMin);
  const taken = floorish(askMax ?? 0) || min;
  return Math.max(taken, min + BUILDER_BONUS_HEDGE, BUILDER_HOURLY_FLOOR);
}

/** What the client is quoted once the rules and the 85/15 split apply. */
export function suggestedClientHourlyRate(
  askMin: number,
  askMax?: number | null,
): number {
  return Math.ceil(suggestedBuilderHourlyPayout(askMin, askMax) / 0.85);
}

