/**
 * Canonical $BUILD generation + split formula.
 *
 * Source of truth: the master spreadsheet's "Opportunities Sorted"
 * tab. Reverse-engineered against the Total OTE row 2026-07-30 —
 * see `build-vision.md` for the derivation and the full recite.
 *
 * ONE constant lives here for the tokens-per-dollar rate, and ONE
 * split tuple for the destination allocation. Every settlement path
 * that issues $BUILD reads from this module, so a rate change
 * touches one line.
 *
 * Formula:
 *   Network Fees   = 15% of Project Budget
 *   Total $BUILD generated on settlement = Network Fees × BUILD_PER_NETWORK_FEE_DOLLAR
 *   Split of that total:
 *     80% → Talent (distributed per contributor internal-invoice share)
 *     16% → Admin pool (evenly across admins on the deal)
 *      2% → Treasury (house_treasury sentinel)
 *      2% → Liquidity Pool (house_liquidity_pool sentinel)
 *
 * Sanity check (Total OTE row): $6,588,520 project budget →
 * $988,278 network fees → 6,015,605 $BUILD generated → 4,812,484
 * talent / 962,497 admin / 120,312 treasury / 120,312 LP. Sums
 * cleanly to 60.15% of the 10M supply cap.
 */
import type { BuildVoucherSourceType } from "@/lib/types";

/**
 * Tokens generated per $1 of Network Fees. Reciprocal price ≈
 * $0.164 per $BUILD. This value comes from the spreadsheet, not a
 * derivation from other constants — treat it as configuration.
 */
export const BUILD_PER_NETWORK_FEE_DOLLAR = 6.087;

/** Network fee = 15% of project budget. */
export const NETWORK_FEE_PCT = 0.15;

/**
 * Split ratios of the total $BUILD generated at settlement.
 * Sum = 1.0. Cash split (85/12/1.5/1.5) is separate — see
 * settlement-splits.ts.
 */
export const BUILD_TALENT_SHARE = 0.80;
export const BUILD_ADMIN_SHARE = 0.16;
export const BUILD_TREASURY_SHARE = 0.02;
export const BUILD_LP_SHARE = 0.02;

/**
 * How many $BUILD are generated for a settlement of the given
 * gross (contract value / invoice value). Rounded to 8 decimals to
 * match the numeric(18,8) precision.
 */
export function buildGeneratedForGross(gross: number): number {
  const networkFees = gross * NETWORK_FEE_PCT;
  return Math.round(networkFees * BUILD_PER_NETWORK_FEE_DOLLAR * 1e8) / 1e8;
}

export interface BuildSettlementSplit {
  totalGenerated: number;
  talent: number;
  admin: number;
  treasury: number;
  liquidityPool: number;
}

/**
 * Compute the four $BUILD destination amounts for a settlement.
 * Amounts sum to totalGenerated within rounding tolerance.
 */
export function buildSplitForGross(gross: number): BuildSettlementSplit {
  const totalGenerated = buildGeneratedForGross(gross);
  const talent = round8(totalGenerated * BUILD_TALENT_SHARE);
  const admin = round8(totalGenerated * BUILD_ADMIN_SHARE);
  const treasury = round8(totalGenerated * BUILD_TREASURY_SHARE);
  const liquidityPool = round8(
    totalGenerated - talent - admin - treasury,
  );
  return { totalGenerated, talent, admin, treasury, liquidityPool };
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/**
 * Map a cash-settlement source kind to the voucher source-type enum
 * used on issuance. Kept here so the mapping has one home — future
 * source kinds (governance events, referral kickbacks that aren't
 * tied to a settlement) can add entries without touching every
 * caller.
 */
export function voucherSourceTypeFor(
  cashSourceKind:
    | "contract_settlement"
    | "order_settlement"
    | "bonus_release"
    | "donation",
): BuildVoucherSourceType {
  switch (cashSourceKind) {
    case "contract_settlement":
    case "order_settlement":
    case "bonus_release":
      return "project_completion";
    case "donation":
      // Donations don't generate $BUILD (war-chest policy is
      // cash-only Treasury/LP). This branch exists so the caller
      // can't produce an unmapped source kind at compile time.
      return "admin_grant";
  }
}
