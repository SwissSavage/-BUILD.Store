/**
 * Inbox entries (Phase 2.4 sandbox).
 *
 * Seed list of notifications keyed off the existing mock orders,
 * contracts, invoices, RFPs, and seller applications so the
 * /notifications surface has something to render before any real
 * events fire. Each entry hangs off a real `href` into the app so
 * clicking through actually navigates.
 *
 * REPLACE WITH: a `notifications` Drizzle table written by the same
 * server actions that mutate orders/contracts/etc. — fan out to every
 * recipient (buyer, seller, admin, attribution party) at the moment
 * of the underlying event. Read API filtered by the current user.
 */
import type { Notification } from "@/lib/types";

export const MOCK_NOTIFICATIONS: Notification[] = [
  // ── Jamar (admin / member) — sees admin-side fan-out + her own seller activity
  {
    id: "ntf_001",
    userId: "u_jamar",
    kind: "order_status",
    title: "Order BS-1004 placed",
    body: "Aliza placed a $1,800 heat-pump pre-order with Michael. Awaiting payment confirmation.",
    href: "/orders/ord_004",
    createdAt: "2026-04-25T14:12:00Z",
    readAt: null,
  },
  {
    id: "ntf_002",
    userId: "u_jamar",
    kind: "split_distributed",
    title: "Split distributed on BS-1003",
    body: "85/12/1.5/1.5 routed to seller, ops, Treasury, and the Liquidity Pool.",
    href: "/orders/ord_003",
    createdAt: "2026-04-24T09:40:00Z",
    readAt: "2026-04-24T11:02:00Z",
  },
  {
    id: "ntf_003",
    userId: "u_jamar",
    kind: "seller_application",
    title: "New seller application",
    body: "A member applied for marketplace access in goods + clothing. Triage in /admin/marketplace.",
    href: "/admin/marketplace",
    createdAt: "2026-04-24T08:15:00Z",
    readAt: null,
  },
  {
    id: "ntf_004",
    userId: "u_jamar",
    kind: "whitelist_decision",
    title: "Donation received — Underwriter tier",
    body: "$5,000 routed 60/20/20 to ops, Liquidity Pool, and Treasury. Donor flagged 'no access expected.'",
    href: "/admin/whitelist",
    createdAt: "2026-04-23T19:50:00Z",
    readAt: "2026-04-23T20:10:00Z",
  },
  {
    id: "ntf_005",
    userId: "u_jamar",
    kind: "rfp_status",
    title: "Quote sheet ready for vetting",
    body: "A partner submitted a structured quote. Approve or edit before it routes to the client.",
    href: "/admin/quotes",
    createdAt: "2026-04-23T13:25:00Z",
    readAt: null,
  },
  {
    id: "ntf_006",
    userId: "u_jamar",
    kind: "direct_message",
    title: "Beta candidate confirmed — from Sunny",
    body: "Sunny accepted the beta invite. Lens to confirm before kickoff.",
    href: "/notifications",
    createdAt: "2026-04-22T17:05:00Z",
    readAt: "2026-04-22T17:30:00Z",
  },

  // ── Aliza (member, buyer + occasional seller) — buyer-side rail
  {
    id: "ntf_010",
    userId: "u_aliza",
    kind: "order_tracking",
    title: "Tracking added to BS-1002",
    body: "Your zine order shipped via USPS. Tap through for the tracking number.",
    href: "/orders/ord_002",
    createdAt: "2026-04-24T16:30:00Z",
    readAt: null,
  },
  {
    id: "ntf_011",
    userId: "u_aliza",
    kind: "order_status",
    title: "Order BS-1001 is fulfilling",
    body: "Brand intensive deliverable in progress. Jamar will mark it shipped on completion.",
    href: "/orders/ord_001",
    createdAt: "2026-04-22T11:00:00Z",
    readAt: "2026-04-22T12:10:00Z",
  },

  // ── Chibu (member, seller) — seller-side rail
  {
    id: "ntf_020",
    userId: "u_chibu",
    kind: "order_status",
    title: "Order BS-1002 marked shipped",
    body: "Buyer notified. Mark it delivered once the carrier confirms — that's when the split runs.",
    href: "/profile/seller/orders",
    createdAt: "2026-04-24T16:31:00Z",
    readAt: null,
  },

  // ── Michael (prospect → seller, energy lens) — fulfillment-side ping
  {
    id: "ntf_030",
    userId: "u_michael",
    kind: "order_status",
    title: "New order BS-1004",
    body: "Aliza pre-ordered a heat-pump unit. Confirm the build window and advance to 'paid' once payment clears.",
    href: "/profile/seller/orders",
    createdAt: "2026-04-25T14:13:00Z",
    readAt: null,
  },
];

/** Returns this user's inbox newest-first. */
export function notificationsForUser(userId: string): Notification[] {
  return MOCK_NOTIFICATIONS.filter((n) => n.userId === userId).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/** Count unread for the nav badge. */
export function unreadNotificationCount(userId: string): number {
  return MOCK_NOTIFICATIONS.filter(
    (n) => n.userId === userId && n.readAt === null,
  ).length;
}

/**
 * Unread notifications filtered to a specific set of kinds. Used by
 * surface-level strips (Projects, Orders, Wallet, etc.) so each tab
 * only lights up for its own events instead of mirroring the global
 * badge. Newest-first.
 */
export function unreadByKind(
  userId: string,
  kinds: Notification["kind"][],
): Notification[] {
  const set = new Set(kinds);
  return MOCK_NOTIFICATIONS.filter(
    (n) => n.userId === userId && n.readAt === null && set.has(n.kind),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
