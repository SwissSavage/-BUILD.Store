/**
 * Mock marketplace orders — Phase 2.1 sandbox.
 *
 * Seeds across the order lifecycle so buyer history, seller fulfillment
 * dashboard, and admin marketplace overview each have something to render
 * without requiring a real Stripe Connect checkout.
 *
 * Storefront checkout is card-only, so every row carries a Stripe
 * processing markup (`processingFee`) that the buyer absorbs — the math
 * matches `grossUpForCard()` in lib/payments-fees.ts. Splits run against
 * `subtotal`, not `total`.
 *
 * REPLACE WITH: Drizzle `orders` + `order_items` tables. Stripe Connect
 * webhooks flip status to `paid`; seller-side actions advance through
 * fulfillment; buyer-side actions request refunds.
 */
import type { Order } from "@/lib/types";

export const MOCK_ORDERS: Order[] = [
  // Aliza buys Jamar's brand intensive — paid, seller fulfilling
  {
    id: "ord_001",
    number: "BS-ORD-2026-0001",
    buyerId: "u_aliza",
    buyerEmail: "aliza@example.com",
    buyerName: "Aliza",
    sellerId: "u_jamar",
    category: "creative-services",
    status: "fulfilling",
    items: [
      {
        productId: "prod_002",
        titleSnapshot: "Brand strategy intensive — 2-day workshop",
        unitPrice: "12500.00",
        quantity: 1,
        lineTotal: "12500.00",
      },
    ],
    subtotal: "12500.00",
    houseFee: "1875.00",
    processingFee: "373.64",
    total: "12873.64",
    stripePaymentIntentId: "pi_mock_ord_001",
    shippingAddress: null,
    trackingNumber: null,
    internalNote: "Workshop dates booked for May 14–15.",
    placedAt: "2026-04-10T00:00:00Z",
    paidAt: "2026-04-10T00:01:00Z",
    shippedAt: null,
    deliveredAt: null,
    splitDistributedAt: null,
  },

  // Chibu buys Aliza's zine — delivered, eligible for buyer feedback (Phase 2.7)
  {
    id: "ord_002",
    number: "BS-ORD-2026-0002",
    buyerId: "u_chibu",
    buyerEmail: "chibu@example.com",
    buyerName: "Chibu",
    sellerId: "u_aliza",
    category: "goods",
    status: "delivered",
    items: [
      {
        productId: "prod_005",
        titleSnapshot: "Letterpress zine — Issue 01",
        unitPrice: "45.00",
        quantity: 2,
        lineTotal: "90.00",
      },
    ],
    subtotal: "90.00",
    houseFee: "13.50",
    processingFee: "3.00",
    total: "93.00",
    stripePaymentIntentId: "pi_mock_ord_002",
    shippingAddress:
      "Chibu · 248 Knickerbocker Ave · Brooklyn NY 11237 · USA",
    trackingNumber: "9400-1234-5678-9012-3456",
    internalNote: null,
    placedAt: "2026-04-15T00:00:00Z",
    paidAt: "2026-04-15T00:01:00Z",
    shippedAt: "2026-04-17T00:00:00Z",
    deliveredAt: "2026-04-22T00:00:00Z",
    splitDistributedAt: "2026-04-23T09:00:00Z",
  },

  // Guest buys Jamar's wordmark tee — delivered, split distributed
  {
    id: "ord_003",
    number: "BS-ORD-2026-0003",
    buyerId: null,
    buyerEmail: "guest.buyer@example.com",
    buyerName: "Guest Buyer",
    sellerId: "u_jamar",
    category: "clothing",
    status: "delivered",
    items: [
      {
        productId: "prod_006",
        titleSnapshot: "Future Modern wordmark tee — natural dye",
        unitPrice: "60.00",
        quantity: 1,
        lineTotal: "60.00",
      },
    ],
    subtotal: "60.00",
    houseFee: "9.00",
    processingFee: "2.10",
    total: "62.10",
    stripePaymentIntentId: "pi_mock_ord_003",
    shippingAddress:
      "Guest Buyer · 1234 Sample St · Austin TX 78701 · USA",
    trackingNumber: "9400-2222-3333-4444-5555",
    internalNote: null,
    placedAt: "2026-04-01T00:00:00Z",
    paidAt: "2026-04-01T00:01:00Z",
    shippedAt: "2026-04-03T00:00:00Z",
    deliveredAt: "2026-04-08T00:00:00Z",
    splitDistributedAt: "2026-04-09T09:00:00Z",
  },

  // Aliza buys Michael's heat-pump scoping — placed, awaiting payment
  {
    id: "ord_004",
    number: "BS-ORD-2026-0004",
    buyerId: "u_aliza",
    buyerEmail: "aliza@example.com",
    buyerName: "Aliza",
    sellerId: "u_michael",
    category: "energy",
    status: "placed",
    items: [
      {
        productId: "prod_009",
        titleSnapshot: "Residential heat-pump retrofit — NYC, scoping only",
        unitPrice: "750.00",
        quantity: 1,
        lineTotal: "750.00",
      },
    ],
    subtotal: "750.00",
    houseFee: "112.50",
    processingFee: "22.71",
    total: "772.71",
    stripePaymentIntentId: null,
    shippingAddress: null,
    trackingNumber: null,
    internalNote: null,
    placedAt: "2026-04-22T00:00:00Z",
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    splitDistributedAt: null,
  },

  // Cancelled — buyer changed their mind pre-payment
  {
    id: "ord_005",
    number: "BS-ORD-2026-0005",
    buyerId: "u_chibu",
    buyerEmail: "chibu@example.com",
    buyerName: "Chibu",
    sellerId: "u_chibu",
    category: "saas",
    status: "cancelled",
    items: [
      {
        productId: "prod_003",
        titleSnapshot: "Multisig governance dashboard — self-hosted",
        unitPrice: "4800.00",
        quantity: 1,
        lineTotal: "4800.00",
      },
    ],
    subtotal: "4800.00",
    houseFee: "720.00",
    processingFee: "143.67",
    total: "4943.67",
    stripePaymentIntentId: null,
    shippingAddress: null,
    trackingNumber: null,
    internalNote: "Buyer requested cancellation before payment landed.",
    placedAt: "2026-03-28T00:00:00Z",
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    splitDistributedAt: null,
  },
];
