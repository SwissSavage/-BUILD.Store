/**
 * Display helpers for the CooperativeQuote pricing discriminated union.
 *
 * Three shapes, each with its own base unit:
 *   - fixed  : single total contract value in USD
 *   - range  : min/max bracket in USD
 *   - hourly : hourly rate in USD (open-ended, billed as delivered)
 *
 * The 85/12/3 split math applies to whichever base unit is active. The
 * client-facing surface renders "direct to builders" and
 * "cooperative operations" cards side by side, each showing the split
 * amount in the correct unit. Admin surfaces render a compact summary
 * for the list view.
 *
 * All formatting uses en-US USD with no fraction digits for whole
 * dollars and 2 fraction digits for the hourly rate variants where the
 * split can produce cents (e.g. $150/hr * 0.85 = $127.50/hr).
 */

import type { CooperativeQuotePricing } from "@/lib/types";

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
 * Big headline copy that goes at the top of the pricing block.
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
 *   - fixed  : "total contract value"
 *   - range  : "expected total range"
 *   - hourly : "flexible hourly, billed as delivered"
 */
export function pricingUnitLabel(pricing: CooperativeQuotePricing): string {
  switch (pricing.type) {
    case "fixed":
      return "total contract value";
    case "range":
      return "expected total range";
    case "hourly":
      return "flexible hourly, billed as delivered";
  }
}

/**
 * Amount that flows to the builder crew (talent side of the split).
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
 *   - hourly : "$150/hr hourly"
 */
export function pricingCompactSummary(
  pricing: CooperativeQuotePricing,
): string {
  return `${pricingHeadline(pricing)} ${pricing.type}`;
}
