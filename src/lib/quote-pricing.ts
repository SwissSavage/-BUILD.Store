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
 * Format a whole-dollar USD amount without cents. Uses en-US locale.
 */
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
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
 * Big headline copy that goes at the top of a per-Builder pricing
 * block.
 *   - fixed  : "$25,000"
 *   - range  : "$15,000 to $25,000" (avoids the em-dash range operator)
 *   - hourly : "$150/hr"
 */
export function pricingHeadline(pricing: CooperativeQuotePricing): string {
  switch (pricing.type) {
    case "fixed":
      return formatUsd(pricing.baseAmount);
    case "range":
      return `${formatUsd(pricing.baseAmountMin)} to ${formatUsd(pricing.baseAmountMax)}`;
    case "hourly":
      return `${formatUsd(pricing.hourlyRate)}/hr`;
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
      return "fixed";
    case "range":
      return "range";
    case "hourly":
      return "hourly, billed as delivered";
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
      return formatUsd(pricing.baseAmount * pct);
    case "range":
      return `${formatUsd(pricing.baseAmountMin * pct)} to ${formatUsd(pricing.baseAmountMax * pct)}`;
    case "hourly":
      return `${formatUsdCents(pricing.hourlyRate * pct)}/hr`;
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
      return formatUsd(pricing.baseAmount * pct);
    case "range":
      return `${formatUsd(pricing.baseAmountMin * pct)} to ${formatUsd(pricing.baseAmountMax * pct)}`;
    case "hourly":
      return `${formatUsdCents(pricing.hourlyRate * pct)}/hr`;
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
  hourlyRates: number[];
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
  const hourlyRates: number[] = [];
  for (const b of builders) {
    switch (b.pricing.type) {
      case "fixed":
        totalMin += b.pricing.baseAmount;
        totalMax += b.pricing.baseAmount;
        hasNumericTotal = true;
        break;
      case "range":
        totalMin += b.pricing.baseAmountMin;
        totalMax += b.pricing.baseAmountMax;
        hasNumericTotal = true;
        break;
      case "hourly":
        hourlyRates.push(b.pricing.hourlyRate);
        break;
    }
  }
  return {
    hasNumericTotal,
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
    if (agg.totalMin === agg.totalMax) {
      parts.push(formatUsd(agg.totalMin));
    } else {
      parts.push(`${formatUsd(agg.totalMin)} to ${formatUsd(agg.totalMax)}`);
    }
  }
  if (agg.hourlyRates.length > 0) {
    const rateLabels = agg.hourlyRates.map((r) => `${formatUsd(r)}/hr`);
    const joined =
      rateLabels.length === 1
        ? rateLabels[0]
        : rateLabels.length === 2
          ? `${rateLabels[0]} and ${rateLabels[1]}`
          : `${rateLabels.slice(0, -1).join(", ")}, and ${rateLabels[rateLabels.length - 1]}`;
    parts.push(agg.hasNumericTotal ? `plus ${joined}` : joined);
  }
  return parts.join(" ");
}

/**
 * Human unit label for the aggregate. Signals whether the total is
 * fixed or bracketed, and calls out hourly companions.
 */
export function aggregateUnitLabel(agg: AggregateQuotePricing): string {
  if (agg.builderCount === 0) return "";
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
