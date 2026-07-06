/**
 * Order detail (Phase 2.1 sandbox).
 *
 * Visible to:
 *   - the buyer (matches buyerId)
 *   - the seller (matches sellerId)
 *   - any admin
 *
 * Buyer view is read-only; seller view picks up the same form actions
 * the seller fulfillment dashboard uses (advance status, save tracking).
 *
 * This page also serves as the immediate redirect target after
 * placeOrder, so guest flows can land on it via /orders/[id] in
 * sandbox without needing a magic-link step.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_PRODUCTS } from "@/lib/mock-data/products";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MARKETPLACE_CATEGORY_LABELS,
  ORDER_NEXT_STATUSES,
  ORDER_STATUS_LABELS,
  adminName,
  publicName,
} from "@/lib/types";
import {
  advanceOrderStatus,
  updateOrderTracking,
} from "@/lib/order-actions";
import { previewOrderSplit } from "@/lib/order-splits";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { BuyerFeedbackSection } from "@/components/BuyerFeedbackSection";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = MOCK_ORDERS.find((o) => o.id === id);
  if (!order) notFound();

  const current = await getCurrentUser();
  const isBuyer = current?.id === order.buyerId;
  const isSeller = current?.id === order.sellerId;
  const isAdmin = !!current?.isAdmin;
  const isGuest =
    !current && order.buyerId === null; // sandbox guest landing

  if (!isBuyer && !isSeller && !isAdmin && !isGuest) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          You don&apos;t have access to this order
        </h1>
        <p className="mt-2 text-ink-muted">
          Orders are visible to the buyer, the seller, and cooperative
          admins.
        </p>
        <Link
          href="/store"
          className="mt-6 inline-block text-sm text-brand-magenta hover:underline"
        >
          ← Back to the store
        </Link>
      </div>
    );
  }

  const seller = MOCK_USERS.find((u) => u.id === order.sellerId);
  const split = previewOrderSplit(Number(order.subtotal));
  const validNext = ORDER_NEXT_STATUSES[order.status];

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link
        href={isSeller ? "/profile/seller/orders" : "/orders"}
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← {isSeller ? "Seller orders" : "My orders"}
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>
            {MARKETPLACE_CATEGORY_LABELS[order.category]} · {order.number}
          </CardEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Order {order.number}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Status:{" "}
            <span className="font-medium text-ink">
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-semibold">
            ${Number(order.total).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            Placed {new Date(order.placedAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {/* Items */}
        <Card className="lg:col-span-2">
          <CardEyebrow>Items</CardEyebrow>
          <ul className="mt-3 divide-y divide-[var(--surface-border)]">
            {order.items.map((item) => {
              const product = MOCK_PRODUCTS.find((p) => p.id === item.productId);
              return (
                <li
                  key={item.productId}
                  className="flex items-center justify-between py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {item.titleSnapshot}
                    </div>
                    <div className="text-xs text-ink-muted">
                      ${Number(item.unitPrice).toLocaleString()} ×{" "}
                      {item.quantity}
                      {product && product.title !== item.titleSnapshot && (
                        <>
                          {" · "}
                          <span className="text-ink-faint">
                            (current title: {product.title})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    ${Number(item.lineTotal).toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span>Subtotal</span>
            <span className="text-right">
              ${Number(order.subtotal).toLocaleString()}
            </span>
            <span>House fee (15%)</span>
            <span className="text-right text-ink-muted">
              ${Number(order.houseFee).toLocaleString()}
            </span>
            {Number(order.processingFee) > 0 && (
              <>
                <span>Card processing (2.9% + $0.30)</span>
                <span className="text-right text-ink-muted">
                  +${Number(order.processingFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </>
            )}
            <span className="border-t border-[var(--surface-border)] pt-2 font-medium">
              Total
            </span>
            <span className="border-t border-[var(--surface-border)] pt-2 text-right font-medium">
              ${Number(order.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {Number(order.processingFee) > 0 && (
            <p className="mt-2 text-[11px] text-ink-faint">
              Card processing is added so the seller and the cooperative
              net the full subtotal after Stripe's 2.9% + $0.30 cut.
            </p>
          )}
        </Card>

        {/* Side rail */}
        <Card>
          <CardEyebrow>Parties</CardEyebrow>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">
                Buyer
              </div>
              <div className="mt-0.5">{order.buyerName}</div>
              {(isSeller || isAdmin) && (
                <div className="text-xs text-ink-muted">
                  {order.buyerEmail}
                </div>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">
                Seller
              </div>
              <div className="mt-0.5">
                {seller
                  ? isAdmin
                    ? adminName(seller)
                    : publicName(seller)
                  : "Unknown"}
              </div>
            </div>
            {order.shippingAddress && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">
                  Ship to
                </div>
                <div className="mt-0.5 whitespace-pre-line text-xs text-ink-muted">
                  {order.shippingAddress}
                </div>
              </div>
            )}
            {order.trackingNumber && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">
                  Tracking
                </div>
                <div className="mt-0.5 font-mono text-xs">
                  {order.trackingNumber}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Split preview */}
      <Card className="mt-6">
        <CardEyebrow>Split routing on delivery</CardEyebrow>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span>Seller (85%)</span>
          <span className="text-right">${split.seller.toLocaleString()}</span>
          <span>Cooperative ops (12%)</span>
          <span className="text-right">${split.admin.toLocaleString()}</span>
          <span>Treasury (1.5%)</span>
          <span className="text-right">${split.treasury.toLocaleString()}</span>
          <span>Liquidity Pool (1.5%)</span>
          <span className="text-right">
            ${split.liquidityPool.toLocaleString()}
          </span>
        </div>
        {order.splitDistributedAt ? (
          <p className="mt-3 text-xs text-brand-green">
            Split distributed{" "}
            {new Date(order.splitDistributedAt).toLocaleDateString()}.
          </p>
        ) : (
          <p className="mt-3 text-xs text-ink-faint">
            Distribution runs once status moves to Delivered. Admin can
            force-run from /admin/marketplace in sandbox.
          </p>
        )}
      </Card>

      {/* Seller controls */}
      {(isSeller || isAdmin) && validNext.length > 0 && (
        <Card className="mt-6">
          <CardEyebrow>Seller controls</CardEyebrow>
          <CardTitle className="mt-1 text-xl">Advance status</CardTitle>
          <form action={advanceOrderStatus} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={order.id} />
            {validNext.map((status) => (
              <button
                key={status}
                type="submit"
                name="status"
                value={status}
                className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
              >
                Move to {ORDER_STATUS_LABELS[status]}
              </button>
            ))}
          </form>

          <form action={updateOrderTracking} className="mt-6 space-y-2">
            <input type="hidden" name="id" value={order.id} />
            <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
              Tracking number
              <input
                name="trackingNumber"
                defaultValue={order.trackingNumber ?? ""}
                placeholder="USPS / UPS / FedEx tracking"
                className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm normal-case tracking-normal text-ink"
              />
            </label>
            <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
              Internal note (seller + admin only)
              <textarea
                name="internalNote"
                rows={2}
                defaultValue={order.internalNote ?? ""}
                placeholder="Private notes — not shown to buyer."
                className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm normal-case tracking-normal text-ink"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              Save
            </button>
          </form>
        </Card>
      )}

      {(isSeller || isAdmin) && order.internalNote && validNext.length === 0 && (
        <Card className="mt-6">
          <CardEyebrow>Internal note</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">{order.internalNote}</p>
        </Card>
      )}

      {/* ── Buyer feedback (Phase 2.7) — only for buyer, post-delivery ── */}
      {isBuyer && order.status === "delivered" && (
        <BuyerFeedbackSection orderId={order.id} />
      )}
    </div>
  );
}
