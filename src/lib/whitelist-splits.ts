/**
 * Donation split for the /whitelist page — war-chest mode.
 *
 * Whitelist entries are FREE (access is earned, not sold). Donations
 * are a separate, optional flow on the same page: voluntary support
 * of the cooperative. By policy, donations bypass the contributor
 * pool entirely — no individual payout. 100% routes to the two
 * structural pools:
 *
 *   treasury     → 50% of gross. Long-horizon runway.
 *   liquidityPool → 50% of gross. Manufactures $BUILD token value.
 *
 * The ops slice was deliberately retired: while the cooperative is
 * still pre-salary, the founder + core team eat ops costs out of
 * contract revenue and let donations build the war chest. This keeps
 * the "access is earned, not sold" stance structurally honest — no
 * one personally profits from a donation, and every donated dollar
 * visibly compounds into long-horizon capital instead of subsidizing
 * today's hosting bill.
 *
 * REVISIT WHEN: the cooperative starts paying salaries. At that point
 * we may want to reintroduce an ops slice (or shift the mix) so
 * donations can subsidize the people doing the work, not just the
 * structural pools. Until then: war chest first.
 *
 * The old `previewWhitelistSplit` (contract-intake referral for
 * consultation conversions with the 85/12/1.5/1.5 shape) moved to
 * `contract-splits.ts` as `previewConsultationConversionSplit` —
 * it's a contract flow that happens to originate on the whitelist
 * page, not a whitelist flow.
 */

// ──────────────────────────────────────────────────────────────────────
//  Donation split (NO contributor pool, NO ops cut — war-chest mode)
// ──────────────────────────────────────────────────────────────────────

export const WL_DONATION_TREASURY_PCT = 0.5;
export const WL_DONATION_LP_PCT = 0.5;

export interface DonationSplitPreview {
  gross: number;
  treasury: number;
  liquidityPool: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Preview the donation split for the public Whitelist page. By
 * policy: no individual contributor / referrer / admin share, and
 * (for now) no ops cut either — the full amount goes into the
 * cooperative's two structural war-chest pools.
 */
export function previewDonationSplit(amountUsd: number): DonationSplitPreview {
  const gross = round2(amountUsd);
  const treasury = round2(gross * WL_DONATION_TREASURY_PCT);
  const liquidityPool = round2(gross - treasury);
  return { gross, treasury, liquidityPool };
}

// Legacy previewWhitelistSplit moved → src/lib/contract-splits.ts
// as previewConsultationConversionSplit. Import from there for
// consultation-conversion referral math.
