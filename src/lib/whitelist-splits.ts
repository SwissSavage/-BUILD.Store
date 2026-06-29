/**
 * Split automation for whitelist-page financial flows.
 *
 * Two split shapes share this module because the whitelist page hosts
 * two different money flows even though we explicitly do not sell
 * access:
 *
 *   1. DONATION (the public path on /whitelist).
 *      Voluntary support of the cooperative. By policy, donations
 *      bypass the contributor pool entirely — there is no individual
 *      payout. 100% routes to the Treasury + the Liquidity Pool. The
 *      ops slice was deliberately retired: while the cooperative is
 *      still pre-salary, the founder + core team eat ops costs out of
 *      contract revenue and let donations build the war chest. This
 *      keeps the "access is earned, not sold" stance structurally
 *      honest — no one personally profits from someone donating, and
 *      every donated dollar visibly compounds into long-horizon
 *      capital instead of subsidizing today's hosting bill.
 *
 *        treasury     → 50% of gross. Long-horizon runway.
 *        liquidityPool → 50% of gross. Manufactures $BUILD token value.
 *
 *      REVISIT WHEN: the cooperative starts paying salaries. At that
 *      point we may want to reintroduce an ops slice (or shift the
 *      mix) so donations can subsidize the people doing the work, not
 *      just the structural pools. Until then: war chest first.
 *
 *   2. CONTRACT-INTAKE referral (legacy whitelist path, kept for
 *      consultation conversions). When a scoping consultation closes
 *      into a paid contract, the referrer who brought the lead earns
 *      the same 85/12/3 split contracts use. Implemented as the legacy
 *      `previewWhitelistSplit()` for back-compat with the consultation
 *      admin queue. Donations DO NOT use this path.
 *
 * REPLACE WITH: shared split-engine module once contract settlement +
 * marketplace + consultation conversions all converge on the same
 * function. Donations stay separate — they're not a payout split.
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

// ──────────────────────────────────────────────────────────────────────
//  Legacy contract-intake referral split (consultation conversions)
//
//  Kept for the consultation admin queue. Once a consultation
//  converts into a closed contract, the engine credits the referrer
//  who brought the lead under the same 85/12/3 we use elsewhere.
// ──────────────────────────────────────────────────────────────────────

export const WL_CONTRIBUTOR_PCT = 0.85;
export const WL_ADMIN_PCT = 0.12;
export const WL_RESERVE_PCT = 0.03;
export const WL_RESERVE_TREASURY_PCT = 0.5;
export const WL_RESERVE_LP_PCT = 0.5;

export interface WhitelistSplitPreview {
  gross: number;
  contributor: number;
  admin: number;
  treasury: number;
  liquidityPool: number;
  contributorLabel: string;
}

export function previewWhitelistSplit(
  amountUsd: number,
  referrerLabel: string | null,
): WhitelistSplitPreview {
  const gross = round2(amountUsd);
  const contributor = round2(gross * WL_CONTRIBUTOR_PCT);
  const admin = round2(gross * WL_ADMIN_PCT);
  const reserve = round2(gross * WL_RESERVE_PCT);
  const treasury = round2(reserve * WL_RESERVE_TREASURY_PCT);
  const liquidityPool = round2(reserve - treasury);
  return {
    gross,
    contributor,
    admin,
    treasury,
    liquidityPool,
    contributorLabel: referrerLabel ?? "Cooperative network pool",
  };
}
