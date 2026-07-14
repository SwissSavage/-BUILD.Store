/**
 * Marketplace order split.
 *
 * Same structural pattern as contract settlement, with one party in
 * each pool:
 *   - seller (85%) — the builder who listed the product/service.
 *   - admin pool (12%) — operating share for the cooperative.
 *   - reserve (3%)  — 50/50 Treasury + Liquidity Pool, non-negotiable.
 *
 * `houseFee` on the Order record is the gross 15% the cooperative
 * collects (admin + reserve combined). This module just breaks that
 * 15% into the published 12 / 1.5 / 1.5 lanes so the seller sees
 * exactly where their money went.
 *
 * REPLACE WITH: shared split-engine module — see whitelist-splits.ts +
 * the contract settlement engine for the converging shape.
 */

export const ORDER_SELLER_PCT = 0.85;
export const ORDER_ADMIN_PCT = 0.12;
export const ORDER_RESERVE_PCT = 0.03;
export const ORDER_RESERVE_TREASURY_PCT = 0.5;
export const ORDER_RESERVE_LP_PCT = 0.5;

export interface OrderSplitPreview {
  gross: number;
  seller: number;
  admin: number;
  treasury: number;
  liquidityPool: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function previewOrderSplit(amountUsd: number): OrderSplitPreview {
  const gross = round2(amountUsd);
  const seller = round2(gross * ORDER_SELLER_PCT);
  const admin = round2(gross * ORDER_ADMIN_PCT);
  const reserve = round2(gross * ORDER_RESERVE_PCT);
  const treasury = round2(reserve * ORDER_RESERVE_TREASURY_PCT);
  const liquidityPool = round2(reserve - treasury);
  return { gross, seller, admin, treasury, liquidityPool };
}
