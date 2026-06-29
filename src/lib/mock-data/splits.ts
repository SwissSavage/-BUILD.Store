/**
 * Mock revenue split rows — output of the 85 / 15 split engine when an admin
 * settles a closed contract.
 *
 * Three pools, mirroring the spreadsheet's settled-engagements model:
 *
 *   contributor → 85% of collected revenue. Goes to delivery contributors
 *                 (sourced from attribution ledger entries with role
 *                 `delivery_lead` / `contributor`).
 *
 *   admin       → 80% of the 15% commission (= 12% of revenue). Split across
 *                 the contract's admins (`Project.adminUserIds`) — referrers,
 *                 deal owners, anyone growing the business on this contract.
 *                 Even split by default; admin can override at settlement.
 *                 N admins supported.
 *
 *   reserve     → 20% of the 15% commission (= 3% of revenue). Auto-routed
 *                 50/50 between Treasury and the Liquidity Pool. The LP
 *                 deposit manufactures token value rather than leaving it to
 *                 the market — non-negotiable, never editable.
 *
 * Coverage:
 *   p_004 (closed editorial series — $12,000 collected) is fully settled:
 *     - Aliza  → contributor pool, 100% ($10,200) — sole delivery contributor.
 *     - Jamar  → admin pool, 100% ($1,440) — sole admin on the deal (intro).
 *     - Treasury → reserve pool, 50% of reserve ($180).
 *     - LP       → reserve pool, 50% of reserve ($180).
 *
 *   p_003 has no split rows yet — contract is in_progress and revenue
 *   hasn't landed. Settlement page scaffolds rows when revenue is collected.
 *
 * REPLACE WITH: Drizzle inserts into `revenue_splits`. Engine writes the
 * rows on settlement; payout dispatcher updates `payoutStatus` /
 * `stripeTransferId` as Stripe Connect transfers complete.
 *
 * The two reserve recipient IDs map to Future Modern's own destinations
 * (held by the platform, not contributor accounts):
 *   - house_treasury        → operating treasury
 *   - house_liquidity_pool  → $BUILD token liquidity pool deposit
 */
import type { RevenueSplit } from "@/lib/types";

export const MOCK_SPLITS: RevenueSplit[] = [
  // Contributor pool (85% of $12,000 = $10,200)
  {
    id: "split_001",
    contractId: "p_004",
    recipientId: "u_aliza",
    pool: "contributor",
    sharePct: "100.00",
    amount: "10200.00",
    auto: false,
    decidedBy: "u_jamar",
    decidedAt: "2026-02-21T14:00:00Z",
    payoutStatus: "sent",
    payoutSentAt: "2026-02-22T09:00:00Z",
    stripeTransferId: "tr_1Q9aliza_p004",
    notes: "Sole delivery contributor.",
  },

  // Admin pool (80% of 15% commission = $1,440)
  {
    id: "split_002",
    contractId: "p_004",
    recipientId: "u_jamar",
    pool: "admin",
    sharePct: "100.00",
    amount: "1440.00",
    auto: false,
    decidedBy: "u_jamar",
    decidedAt: "2026-02-21T14:00:00Z",
    payoutStatus: "sent",
    payoutSentAt: "2026-02-22T09:00:00Z",
    stripeTransferId: "tr_1Q9jamar_p004",
    notes: "Sole admin on the deal — URL Media intro.",
  },

  // Reserve pool (20% of 15% commission = $360, split 50/50)
  {
    id: "split_003",
    contractId: "p_004",
    recipientId: "house_treasury",
    pool: "reserve",
    sharePct: "50.00",
    amount: "180.00",
    auto: true,
    decidedBy: null,
    decidedAt: null,
    payoutStatus: "sent",
    payoutSentAt: "2026-02-22T09:00:00Z",
    stripeTransferId: "tr_1Q9treasury_p004",
    notes: "Auto-routed: 50% of reserve to operating treasury.",
  },
  {
    id: "split_004",
    contractId: "p_004",
    recipientId: "house_liquidity_pool",
    pool: "reserve",
    sharePct: "50.00",
    amount: "180.00",
    auto: true,
    decidedBy: null,
    decidedAt: null,
    payoutStatus: "sent",
    payoutSentAt: "2026-02-22T09:00:00Z",
    stripeTransferId: "tr_1Q9lp_p004",
    notes: "Auto-routed: 50% of reserve to $BUILD liquidity pool.",
  },
];

/**
 * Reserve-pool recipients. Both are auto-routed (50% each of the reserve
 * pool, which is 20% of the commission, which is 3% of revenue). These
 * IDs aren't User records — they're platform-owned Stripe destinations.
 *
 * The Liquidity Pool deposit is the token-value mechanism: a fixed share
 * of every settled contract goes in, structurally manufacturing token
 * value rather than leaving it to market dynamics.
 */
export const RESERVE_RECIPIENTS: Array<{
  id: string;
  label: string;
  description: string;
  /** Share of the reserve pool (sums to 100% across rows). */
  reserveSharePct: number;
}> = [
  {
    id: "house_treasury",
    label: "Treasury",
    description:
      "Operating treasury — runway for ongoing platform costs and admin overhead.",
    reserveSharePct: 50,
  },
  {
    id: "house_liquidity_pool",
    label: "$BUILD Liquidity Pool",
    description:
      "Manufactures token value over time. Fixed share of every settled contract — non-negotiable by design.",
    reserveSharePct: 50,
  },
];
