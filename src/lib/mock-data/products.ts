/**
 * Mock products — Phase 2.1 marketplace sandbox.
 *
 * Seeded across every category so the /store browse surface has something
 * to filter against. Sellers reference users in MOCK_USERS. Status values
 * let us demo the admin vetting queue without needing real submissions.
 *
 * REPLACE WITH: Drizzle `products` table queries. The subdomain routing
 * (goods.build.store, saas.build.store, etc.) is a middleware filter on
 * `category`, not separate tables.
 */
import type { Product } from "@/lib/types";

export const MOCK_PRODUCTS: Product[] = [
  // ───────────────  Creative services  ───────────────
  {
    id: "prod_001",
    sellerId: "u_aliza",
    category: "creative-services",
    title: "Editorial profile package — long-form feature",
    description:
      "Fortune 500-grade artist or founder profile. 2,000 words, two rounds of revisions, photography direction. Delivery in 3 weeks.",
    price: "3200.00",
    currency: "USD",
    inventoryCount: null,
    imageUrls: [],
    tags: ["editorial", "longform", "interviewing"],
    categorySlugs: ["services", "art"],
    status: "active",
    adminNote: null,
    createdAt: "2026-03-10T00:00:00Z",
    updatedAt: "2026-03-10T00:00:00Z",
  },
  {
    id: "prod_002",
    sellerId: "u_jamar",
    category: "creative-services",
    title: "Brand strategy intensive — 2-day workshop",
    description:
      "Narrative, positioning, visual direction. Two days on-site, one deliverable deck. Works best for pre-Series-A startups.",
    price: "12500.00",
    currency: "USD",
    inventoryCount: null,
    imageUrls: [],
    tags: ["brand", "strategy", "workshop"],
    categorySlugs: ["services"],
    status: "active",
    adminNote: null,
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-03-15T00:00:00Z",
  },

  // ───────────────  SaaS  ───────────────
  {
    id: "prod_003",
    sellerId: "u_chibu",
    category: "saas",
    title: "Multisig governance dashboard — self-hosted",
    description:
      "Open-source governance UI for ERC-6551 vaults. Annual license + update channel. White-label-ready for cooperatives.",
    price: "4800.00",
    currency: "USD",
    inventoryCount: null,
    imageUrls: [],
    tags: ["solidity", "governance", "dashboard"],
    categorySlugs: ["software"],
    status: "active",
    adminNote: null,
    createdAt: "2026-02-20T00:00:00Z",
    updatedAt: "2026-02-20T00:00:00Z",
  },
  {
    id: "prod_004",
    sellerId: "u_michael",
    category: "saas",
    title: "GTM readiness scorecard — self-serve",
    description:
      "Eight-axis readiness rubric for B2B expansion, delivered as a scored spreadsheet + 30-minute walkthrough. No commitment beyond the single engagement.",
    price: "1200.00",
    currency: "USD",
    inventoryCount: null,
    imageUrls: [],
    tags: ["gtm", "b2b", "ops"],
    categorySlugs: ["software", "services"],
    status: "pending_review",
    adminNote: null,
    createdAt: "2026-04-18T00:00:00Z",
    updatedAt: "2026-04-18T00:00:00Z",
  },

  // ───────────────  Goods  ───────────────
  {
    id: "prod_005",
    sellerId: "u_aliza",
    category: "goods",
    title: "Letterpress zine — Issue 01",
    description:
      "Limited run of 150. Hand-set letterpress, recycled paper. Afrofuturist editorial on the cooperative economy.",
    price: "45.00",
    currency: "USD",
    inventoryCount: 112,
    imageUrls: [],
    tags: ["zine", "letterpress", "afrofuturist"],
    categorySlugs: ["art", "merchandise"],
    status: "active",
    adminNote: null,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-04-10T00:00:00Z",
  },

  // ───────────────  Clothing  ───────────────
  {
    id: "prod_006",
    sellerId: "u_jamar",
    category: "clothing",
    title: "Future Modern wordmark tee — natural dye",
    description:
      "Heavyweight 100% cotton, plant-dyed. Three colorways. Limited first drop of 200 per color. Ships from Brooklyn.",
    price: "60.00",
    currency: "USD",
    inventoryCount: 540,
    imageUrls: [],
    tags: ["apparel", "cotton", "natural-dye"],
    categorySlugs: ["merchandise"],
    status: "active",
    adminNote: null,
    createdAt: "2026-02-15T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "prod_007",
    sellerId: "u_rob",
    category: "clothing",
    title: "Deadstock workwear capsule — 5 pieces",
    description:
      "Rescued industrial canvas rebuilt into modern work sets. Size-graded, sewn in NYC. Drops seasonally.",
    price: "320.00",
    currency: "USD",
    inventoryCount: 12,
    imageUrls: [],
    tags: ["apparel", "deadstock", "workwear"],
    categorySlugs: ["merchandise"],
    status: "draft",
    adminNote: null,
    createdAt: "2026-04-15T00:00:00Z",
    updatedAt: "2026-04-15T00:00:00Z",
  },

  // ───────────────  Energy  ───────────────
  {
    id: "prod_008",
    sellerId: "u_chibu",
    category: "energy",
    title: "Portable solar kit — 400W travel set",
    description:
      "Foldable panel + 1kWh LiFePO4 battery. Tested for NYC rooftop use. Two-year warranty direct from the assembler.",
    price: "1480.00",
    currency: "USD",
    inventoryCount: 24,
    imageUrls: [],
    tags: ["solar", "portable", "hardware"],
    categorySlugs: ["energy", "hardware"],
    status: "pending_review",
    adminNote: null,
    createdAt: "2026-04-12T00:00:00Z",
    updatedAt: "2026-04-12T00:00:00Z",
  },
  {
    id: "prod_009",
    sellerId: "u_michael",
    category: "energy",
    title: "Residential heat-pump retrofit — NYC, scoping only",
    description:
      "Initial site visit + load calculation + contractor shortlist for NYC brownstones. Not full install. Flat-fee scoping.",
    price: "750.00",
    currency: "USD",
    inventoryCount: null,
    imageUrls: [],
    tags: ["electrification", "retrofit", "consulting"],
    categorySlugs: ["energy", "services"],
    status: "active",
    adminNote: null,
    createdAt: "2026-03-25T00:00:00Z",
    updatedAt: "2026-03-25T00:00:00Z",
  },

  // ───────────────  Rejected example  ───────────────
  {
    id: "prod_010",
    sellerId: "u_trevor",
    category: "goods",
    title: "Resale watch — no provenance",
    description:
      "Pre-owned watch, authenticity uncertain. Priced below retail.",
    price: "2100.00",
    currency: "USD",
    inventoryCount: 1,
    imageUrls: [],
    tags: ["watch", "resale"],
    categorySlugs: ["merchandise"],
    status: "rejected",
    adminNote:
      "Provenance required. Cooperative policy — resold items need documented chain of custody.",
    createdAt: "2026-04-08T00:00:00Z",
    updatedAt: "2026-04-09T00:00:00Z",
  },
];
