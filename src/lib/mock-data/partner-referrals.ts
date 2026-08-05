/**
 * Partner referral attribution ledger seed. Sandbox store — swaps
 * to the Drizzle `partner_referrals` table in production.
 */
import type { PartnerReferral } from "@/lib/types";

export const MOCK_PARTNER_REFERRALS: PartnerReferral[] = [
  // Jamar referred a lead to LaserReach (SaaS Partner); still pending.
  {
    id: "pref_laserreach_001",
    partnerId: "eco_laserreach",
    partnerKind: "saas_partner",
    referrerUserId: "u_jamar",
    leadContactName: "Ross Trevor",
    leadContactEmail: "ross@example.com",
    leadCompany: "Independent",
    notes: "Warm intro from a mutual — good fit for LaserReach's outbound.",
    status: "pending",
    convertedAmountUsd: null,
    revshareEarnedUsd: null,
    convertedAt: null,
    declineReason: null,
    declinedAt: null,
    createdAt: "2026-07-20T14:00:00Z",
    updatedAt: "2026-07-20T14:00:00Z",
  },
  // Bayu referred a lead to Dial.WTF (SaaS Partner); converted.
  {
    id: "pref_dial_001",
    partnerId: "eco_dial_wtf",
    partnerKind: "saas_partner",
    referrerUserId: "u_bayu",
    leadContactName: "Aliza Client",
    leadContactEmail: "aliza-client@example.com",
    leadCompany: "Design Collective",
    notes: "Passed along after design-community intro.",
    status: "converted",
    convertedAmountUsd: "2400.00",
    revshareEarnedUsd: "480.00",
    convertedAt: "2026-06-15T10:00:00Z",
    declineReason: null,
    declinedAt: null,
    createdAt: "2026-05-28T09:00:00Z",
    updatedAt: "2026-06-15T10:00:00Z",
  },
];
