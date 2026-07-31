/**
 * Preview math for contract-shape settlements (contracts, orders,
 * consultation conversions, bonus releases). All use the canonical
 * 85 / 12 / 1.5 / 1.5 split.
 *
 * PREVIEW ONLY — no writes. Actual persistence lives in
 * `settlement-splits.ts` (writeStandardSettlementSplits).
 *
 * Existing per-flow preview modules (`order-splits.ts` for
 * marketplace, `previewConsultationConversionSplit` here for
 * consultation referrals) all follow the same shape and should
 * consolidate here as their surfaces refactor.
 */

export const STANDARD_CONTRIBUTOR_PCT = 0.85;
export const STANDARD_ADMIN_PCT = 0.12;
export const STANDARD_TREASURY_PCT = 0.015;
export const STANDARD_LP_PCT = 0.015;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface ConsultationConversionSplitPreview {
  gross: number;
  contributor: number;
  admin: number;
  treasury: number;
  liquidityPool: number;
  contributorLabel: string;
}

/**
 * When a scoping consultation booked through /whitelist converts to
 * a paid contract, the referrer who brought the lead earns the
 * standard contract split. Formerly `previewWhitelistSplit` in
 * `whitelist-splits.ts` — moved here for accurate naming (it's a
 * contract flow, not a whitelist flow).
 */
export function previewConsultationConversionSplit(
  amountUsd: number,
  referrerLabel: string | null,
): ConsultationConversionSplitPreview {
  const gross = round2(amountUsd);
  const contributor = round2(gross * STANDARD_CONTRIBUTOR_PCT);
  const admin = round2(gross * STANDARD_ADMIN_PCT);
  const treasury = round2(gross * STANDARD_TREASURY_PCT);
  const liquidityPool = round2(gross * STANDARD_LP_PCT);
  return {
    gross,
    contributor,
    admin,
    treasury,
    liquidityPool,
    contributorLabel: referrerLabel ?? "Cooperative network pool",
  };
}
