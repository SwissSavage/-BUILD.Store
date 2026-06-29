/**
 * Mock seller applications — Phase 2.1 marketplace vetting queue.
 *
 * Admins approve before a member can publish product. Each application
 * captures what categories the member wants to sell in plus a short
 * pitch — lets admin review the fit (goods shipping logistics vs. SaaS
 * support model vs. creative services engagement shape are very
 * different vetting questions).
 *
 * REPLACE WITH: Drizzle `seller_applications` queries. Approval writes
 * the approved categories onto a `seller_profiles` row on the user;
 * rejection keeps the application for audit + lets the member resubmit.
 */
import type { SellerApplication } from "@/lib/types";

export const MOCK_SELLER_APPLICATIONS: SellerApplication[] = [
  {
    id: "sa_001",
    userId: "u_aliza",
    requestedCategories: ["creative-services", "goods"],
    pitch:
      "Editorial + letterpress zine work. Shipping handled through a Brooklyn print partner I've used for three years.",
    status: "approved",
    reviewedBy: "u_jamar",
    reviewedAt: "2026-02-28T00:00:00Z",
    adminNote: "Approved — portfolio piece prod_001 already reviewed.",
    createdAt: "2026-02-20T00:00:00Z",
  },
  {
    id: "sa_002",
    userId: "u_chibu",
    requestedCategories: ["saas", "energy"],
    pitch:
      "Multisig governance dashboard (self-hosted license) plus a portable solar kit I assemble with a partner factory in Taiwan. Warranty routed through me.",
    status: "approved",
    reviewedBy: "u_jamar",
    reviewedAt: "2026-02-18T00:00:00Z",
    adminNote: "Approved for both categories. Ping on hardware returns policy.",
    createdAt: "2026-02-15T00:00:00Z",
  },
  {
    id: "sa_003",
    userId: "u_jamar",
    requestedCategories: ["creative-services", "clothing"],
    pitch:
      "Brand strategy engagements + the Future Modern wordmark drop. Apparel runs through a Brooklyn fulfillment shop.",
    status: "approved",
    reviewedBy: "u_jamar",
    reviewedAt: "2026-02-10T00:00:00Z",
    adminNote: null,
    createdAt: "2026-02-10T00:00:00Z",
  },
  {
    id: "sa_004",
    userId: "u_michael",
    requestedCategories: ["saas", "energy"],
    pitch:
      "GTM scorecard as a self-serve product, plus residential heat-pump retrofit scoping for NYC brownstones. Scoping only — not full install.",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: "2026-04-17T00:00:00Z",
  },
  {
    id: "sa_005",
    userId: "u_rob",
    requestedCategories: ["clothing"],
    pitch:
      "Deadstock workwear capsule sewn in NYC. Seasonal drops, limited quantities. Cooperative apparel partner on fulfillment.",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: "2026-04-14T00:00:00Z",
  },
  {
    id: "sa_006",
    userId: "u_trevor",
    requestedCategories: ["goods"],
    pitch:
      "Pre-owned resale at discounted prices.",
    status: "rejected",
    reviewedBy: "u_jamar",
    reviewedAt: "2026-04-09T00:00:00Z",
    adminNote:
      "Provenance required for any resale category. Resubmit with documented chain-of-custody workflow.",
    createdAt: "2026-04-07T00:00:00Z",
  },
];
