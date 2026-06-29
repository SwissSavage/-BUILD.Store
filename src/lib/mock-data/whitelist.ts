/**
 * Mock whitelist — Phase 2.3 pre-launch sandbox.
 *
 * Workers' cooperative posture: ACCESS IS NOT FOR SALE. Membership and
 * tier standing are exclusively earned. The Whitelist surface hosts
 * two non-access flows:
 *
 *   1. Donations  → optional financial support of the cooperative.
 *      No access perks. 100% of the donation routes to operating
 *      costs, the Liquidity Pool, and the Treasury (see
 *      whitelist-splits.ts → previewDonationSplit). Donors get a
 *      thank-you and a transparent breakdown — that's the deal.
 *
 *   2. Consultation → an external client booking a scoping call for
 *      custom work. $0, routes to an intake form. Becomes a normal
 *      contract intake.
 *
 * Cash uses Stripe payment intents; crypto uses an on-chain USDC
 * transfer to the cooperative treasury wallet.
 *
 * REPLACE WITH: Drizzle `whitelist_tiers`, `whitelist_purchases`, and
 * `consultation_requests` tables. Stripe webhook flips
 * status=initiated → paid; the donation split routes the funds; no
 * individual payouts are dispatched.
 */
import type {
  WhitelistTier,
  WhitelistPurchase,
  ConsultationRequest,
} from "@/lib/types";

export const MOCK_WHITELIST_TIERS: WhitelistTier[] = [
  {
    id: "wl_donate_supporter",
    slug: "donate-supporter",
    name: "Supporter",
    blurb:
      "Keep the lights on. Covers a slice of hosting, tooling, and the unsexy ops costs that let the cooperative exist.",
    priceUsd: "50.00",
    seatCap: null,
    seatsClaimed: 142,
    accent: "#5070F0",
    isDonation: true,
    isConsultation: false,
    perks: [
      "Funds operations (hosting, tooling, legal)",
      "Topped up to the Liquidity Pool + Treasury",
      "No individual payout — this is not a sale",
      "Public thank-you on the supporters wall (opt-in)",
    ],
    active: true,
  },
  {
    id: "wl_donate_advocate",
    slug: "donate-advocate",
    name: "Advocate",
    blurb:
      "Materially supports the year. Equivalent to a quiet underwriting of the next quarter's tooling + legal runway.",
    priceUsd: "500.00",
    seatCap: null,
    seatsClaimed: 18,
    accent: "#D828A0",
    isDonation: true,
    isConsultation: false,
    perks: [
      "Funds operations (hosting, tooling, legal)",
      "Topped up to the Liquidity Pool + Treasury",
      "No individual payout — this is not a sale",
      "Optional letter of acknowledgement from leadership",
    ],
    active: true,
  },
  {
    id: "wl_donate_underwriter",
    slug: "donate-underwriter",
    name: "Underwriter",
    blurb:
      "Long-horizon support. We will not name this 'membership' or 'partnership' — those have to be earned. We will say thank you, in writing, in person, however you like.",
    priceUsd: "5000.00",
    seatCap: null,
    seatsClaimed: 2,
    accent: "#007048",
    isDonation: true,
    isConsultation: false,
    perks: [
      "Funds operations (hosting, tooling, legal)",
      "Topped up to the Liquidity Pool + Treasury",
      "No individual payout — this is not a sale",
      "Coffee/dinner on us when we're in your city (no obligation)",
    ],
    active: true,
  },
  {
    id: "wl_consult",
    slug: "consultation",
    name: "Custom build · consultation",
    blurb:
      "External client looking for a custom build? Book a scoping call. We take the briefing, route to the right cooperators, and come back with a tailored proposal.",
    priceUsd: "0.00",
    seatCap: null,
    seatsClaimed: 0,
    accent: "#D828A0",
    isDonation: false,
    isConsultation: true,
    perks: [
      "30-minute scoping call within 3 business days",
      "Written briefing recap + recommended pillar fit",
      "Quote sheet prepared if the work clears vetting",
      "No commitment — walk away if it isn't right",
    ],
    active: true,
  },
];

/**
 * Past donations — kept on the WhitelistPurchase shape so the admin
 * queue can stay one table. `referrerId` is no-op on donations (no
 * payout is dispatched), preserved only for historical accuracy on
 * who first introduced the donor.
 */
export const MOCK_WHITELIST_PURCHASES: WhitelistPurchase[] = [
  {
    id: "wlp_001",
    tierId: "wl_donate_advocate",
    buyerId: "u_aliza",
    buyerEmail: "aliza@example.com",
    buyerName: "Aliza",
    rail: "cash",
    amountUsd: "500.00",
    processingFee: "15.24",
    stripePaymentIntentId: "pi_mock_aliza_advocate",
    cryptoTxHash: null,
    referrerId: null,
    status: "split_distributed",
    createdAt: "2026-03-01T00:00:00Z",
    paidAt: "2026-03-01T00:10:00Z",
    splitDistributedAt: "2026-03-02T09:00:00Z",
  },
  {
    id: "wlp_002",
    tierId: "wl_donate_supporter",
    buyerId: "u_chibu",
    buyerEmail: "chibu@example.com",
    buyerName: "Chibu",
    rail: "crypto",
    amountUsd: "50.00",
    processingFee: "0.00",
    stripePaymentIntentId: null,
    cryptoTxHash: "0xmock_chibu_supporter_01",
    referrerId: null,
    status: "split_distributed",
    createdAt: "2026-03-10T00:00:00Z",
    paidAt: "2026-03-10T00:05:00Z",
    splitDistributedAt: "2026-03-11T09:00:00Z",
  },
  {
    id: "wlp_003",
    tierId: "wl_donate_supporter",
    buyerId: null,
    buyerEmail: "new.supporter@example.com",
    buyerName: "Sam Supporter",
    rail: "cash",
    amountUsd: "50.00",
    processingFee: "1.80",
    stripePaymentIntentId: "pi_mock_sam_supporter",
    cryptoTxHash: null,
    referrerId: null,
    status: "paid",
    createdAt: "2026-04-20T00:00:00Z",
    paidAt: "2026-04-20T00:02:00Z",
    splitDistributedAt: null,
  },
  {
    id: "wlp_004",
    tierId: "wl_donate_underwriter",
    buyerId: null,
    buyerEmail: "pending.underwriter@example.com",
    buyerName: "Dana Underwriter",
    rail: "crypto",
    amountUsd: "5000.00",
    processingFee: "0.00",
    stripePaymentIntentId: null,
    cryptoTxHash: null,
    referrerId: null,
    status: "initiated",
    createdAt: "2026-04-22T00:00:00Z",
    paidAt: null,
    splitDistributedAt: null,
  },
];

export const MOCK_CONSULTATION_REQUESTS: ConsultationRequest[] = [
  {
    id: "cr_001",
    tierId: "wl_consult",
    contactName: "Mara Lin",
    contactEmail: "mara@lin-studio.example",
    company: "Lin Studio",
    scopeBuckets: ["creative-media", "professional-services"],
    briefing:
      "Rebrand for a 40-person legal-tech scaleup. Need brand system + founder narrative + website. Three-month runway to the refresh.",
    budgetHint: "$80k–$120k",
    status: "scheduled",
    assignedTo: "u_jamar",
    adminNote: "Scoping call booked for Friday; Jamar to lead.",
    createdAt: "2026-04-18T00:00:00Z",
  },
  {
    id: "cr_002",
    tierId: "wl_consult",
    contactName: "Priya Rao",
    contactEmail: "priya@boroughgreen.example",
    company: "Borough Green Coop",
    scopeBuckets: ["stem", "professional-services"],
    briefing:
      "Residential heat-pump retrofit program for 60 Brooklyn brownstones. Need scoping + contractor coordination + resident communication.",
    budgetHint: "$200k phase 1",
    status: "new",
    assignedTo: null,
    adminNote: null,
    createdAt: "2026-04-21T00:00:00Z",
  },
];
