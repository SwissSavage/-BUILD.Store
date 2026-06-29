/**
 * Seller fulfillment dashboard (Phase 2.1 sandbox).
 *
 * Lists every order whose `sellerId` matches the current user. Grouped
 * by status so action queues (placed → paid → fulfilling → shipped →
 * delivered) live in one place. Each row exposes the same advance +
 * tracking actions the order detail page does, so a busy seller can
 * triage without click-throughs.
 *
 * REPLACE WITH: Drizzle query filtered on sellerId + indexed by
 * status. Carrier tracking webhooks (USPS/FedEx) replace the manual
 * shipped → delivered transition.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import {
  MARKETPLACE_CATEGORY_LABELS,
  ORDER_NEXT_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/lib/types";
import {
  advanceOrderStatus,
  updateOrderTracking,
} from "@/lib/order-actions";
import { previewOrderSplit } from "@/lib/order-splits";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const STATUS_ORDER: OrderStatus[] = [
  "placed",
  "paid",
  "fulfilling",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export default async function SellerOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile/seller/orders");

  const mine = MOCK_ORDERS.filter((o) => o.sellerId === user.id);
  const lifetimeRevenue = mine
    .filter((o) => o.status === "delivered" || o.status === "shipped")
    .reduce((sum, o) => sum + Number(o.subtotal), 0);
  const lifetimeSellerEarnings = mine
    .filter((o) => o.splitDistributedAt)
    .reduce((sum, o) => sum + previewOrderSplit(Number(o.subtotal)).seller, 0);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link
        href="/profile"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Profile
      </Link>
      <div className="mt-3">
        <CardEyebrow>Marketplace fulfillment</CardEyebrow>
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">Your orders</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Every order placed with you. Use the buttons on each row to
        advance fulfillment. Buyers see the status change immediately;
        the split engine runs once you mark an order delivered.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Card>
          <CardEyebrow>Lifetime orders</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">{mine.length}</CardTitle>
        </Card>
        <Card>
          <CardEyebrow>Lifetime revenue (subtotal)</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            ${Math.round(lifetimeRevenue).toLocaleString()}
          </CardTitle>
        </Card>
        <Card>
          <CardEyebrow>Distributed to you</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            ${Math.round(lifetimeSellerEarnings).toLocaleString()}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            85% of split-distributed orders
          </p>
        </Card>
      </div>

      {mine.length === 0 ? (
        <Card className="mt-8">
          <p className="text-sm text-ink-muted">
            No orders yet. Once your listings start moving you&apos;ll
            triage them here.
          </p>
        </Card>
      ) : (
        STATUS_ORDER.filter((s) => mine.some((o) => o.status === s)).map(
          (status) => {
            const rows = mine
              .filter((o) => o.status === status)
              .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
            return (
              <section key={status} className="mt-8">
                <h2 className="text-xs uppercase tracking-wider text-ink-muted">
                  {ORDER_STATUS_LABELS[status]} ({rows.length})
                </h2>
                <div className="mt-3 space-y-3">
                  {rows.map((order) => {
                    const validNext = ORDER_NEXT_STATUSES[order.status];
                    return (
                      <Card key={order.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardEyebrow>
                              {MARKETPLACE_CATEGORY_LABELS[order.category]} ·{" "}
                              {order.number}
                            </CardEyebrow>
                            <CardTitle className="mt-1">
                              {order.items
                                .map(
                                  (i) =>
                                    `${i.titleSnapshot}${
                                      i.quantity > 1 ? ` × ${i.quantity}` : ""
                                    }`,
                                )
                                .join(" · ")}
                            </CardTitle>
                            <p className="mt-1 text-xs text-ink-muted">
                              Buyer: {order.buyerName} · {order.buyerEmail}
                            </p>
                            {order.shippingAddress && (
                              <p className="mt-1 text-xs text-ink-muted">
                                Ship to:{" "}
                                <span className="text-ink-faint">
                                  {order.shippingAddress}
                                </span>
                              </p>
                            )}
                            {order.trackingNumber && (
                              <p className="mt-1 text-xs text-ink-muted">
                                Tracking:{" "}
                                <span className="font-mono">
                                  {order.trackingNumber}
                                </span>
                              </p>
                            )}
                            {order.internalNote && (
                              <p className="mt-1 text-xs text-ink-faint">
                                Note: {order.internalNote}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-display text-xl font-semibold">
                              ${Number(order.total).toLocaleString()}
                            </div>
                            <div className="mt-1 text-xs text-ink-muted">
                              You: $
                              {previewOrderSplit(
                                Number(order.subtotal),
                              ).seller.toLocaleString()}
                            </div>
                            <Link
                              href={`/orders/${order.id}`}
                              className="mt-2 inline-block text-[11px] text-brand-magenta hover:underline"
                            >
                              Open order →
                            </Link>
                          </div>
                        </div>

                        {validNext.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {validNext.map((target) => (
                              <form
                                key={target}
                                action={advanceOrderStatus}
                              >
                                <input type="hidden" name="id" value={order.id} />
                                <input type="hidden" name="status" value={target} />
                                <button
                                  type="submit"
                                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
                                >
                                  → {ORDER_STATUS_LABELS[target]}
                                </button>
                              </form>
                            ))}
                          </div>
                        )}

                        {(order.status === "fulfilling" ||
                          order.status === "shipped") && (
                          <form
                            action={updateOrderTracking}
                            className="mt-4 flex flex-wrap items-end gap-3"
                          >
                            <input type="hidden" name="id" value={order.id} />
                            <label className="flex flex-1 flex-col text-[10px] uppercase tracking-wider text-ink-faint">
                              Tracking number
                              <input
                                name="trackingNumber"
                                defaultValue={order.trackingNumber ?? ""}
                                placeholder="USPS / UPS / FedEx tracking"
                                className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm normal-case tracking-normal text-ink"
                              />
                            </label>
                            <input
                              type="hidden"
                              name="internalNote"
                              value={order.internalNote ?? ""}
                            />
                            <button
                              type="submit"
                              className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
                            >
                              Save tracking
                            </button>
                          </form>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          },
        )
      )}
    </div>
  );
}
