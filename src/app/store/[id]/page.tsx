/**
 * Product detail + place-order surface (Phase 2.1 sandbox).
 *
 * Public — anyone can land on the page from the /store grid. Order
 * placement uses placeOrder; the form pre-fills name/email when a user
 * is signed in (and hides those inputs to keep the surface clean).
 *
 * Goods/clothing surface a shipping-address textarea. Services and
 * SaaS skip it — those are non-shipped fulfilment.
 *
 * REPLACE WITH: real Stripe Connect Checkout session creation in
 * placeOrder; this sandbox stops at status="placed" with no payment.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PRODUCTS } from "@/lib/mock-data/products";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  INDUSTRY_LABELS,
  MARKETPLACE_CATEGORY_LABELS,
  publicName,
  userPillars,
  type MarketplaceCategory,
} from "@/lib/types";
import { previewOrderSplit } from "@/lib/order-splits";
import { placeOrder } from "@/lib/order-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const CATEGORY_ACCENT: Record<MarketplaceCategory, string> = {
  goods: "#D828A0",
  saas: "#5070F0",
  energy: "#007048",
  "creative-services": "#D828A0",
  clothing: "#5070F0",
};

const SHIPPED_CATEGORIES: MarketplaceCategory[] = ["goods", "clothing", "energy"];

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = MOCK_PRODUCTS.find((p) => p.id === id);
  if (!product) notFound();
  if (product.status !== "active") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          This listing isn&apos;t available
        </h1>
        <p className="mt-2 text-ink-muted">
          The seller has paused or withdrawn it. Status:{" "}
          <code>{product.status}</code>.
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

  const seller = MOCK_USERS.find((u) => u.id === product.sellerId);
  const split = previewOrderSplit(Number(product.price));
  const accent = CATEGORY_ACCENT[product.category];
  const shipped = SHIPPED_CATEGORIES.includes(product.category);
  const current = await getCurrentUser();

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/store" className="text-sm text-ink-muted hover:text-ink">
        ← Store
      </Link>
      <div className="mt-3 grid gap-8 md:grid-cols-2">
        <div>
          <CardEyebrow>{MARKETPLACE_CATEGORY_LABELS[product.category]}</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            {product.title}
          </h1>
          <div
            className="mt-3 font-display text-3xl font-semibold"
            style={{ color: accent }}
          >
            ${Number(product.price).toLocaleString()}
          </div>
          <p className="mt-4 text-sm text-ink-muted">{product.description}</p>

          <div className="mt-4 flex flex-wrap gap-1">
            {product.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] text-ink-muted"
              >
                {t}
              </span>
            ))}
          </div>

          <p className="mt-6 text-xs text-ink-faint">
            Sold by {seller ? publicName(seller) : "a cooperative member"}
            {seller && userPillars(seller).length > 0 && (
              <>
                {" · "}
                <span>
                  {userPillars(seller)
                    .map((p) => INDUSTRY_LABELS[p])
                    .join(" + ")}
                </span>
              </>
            )}
            {product.inventoryCount !== null && (
              <>
                {" · "}
                <span>
                  {product.inventoryCount > 0
                    ? `${product.inventoryCount} in stock`
                    : "Sold out"}
                </span>
              </>
            )}
          </p>

          <Card className="mt-8">
            <CardEyebrow>Where your money goes (15% house cut)</CardEyebrow>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span>Seller (85%)</span>
              <span className="text-right">
                ${split.seller.toLocaleString()}
              </span>
              <span>Cooperative ops (12%)</span>
              <span className="text-right">
                ${split.admin.toLocaleString()}
              </span>
              <span>Treasury (1.5%)</span>
              <span className="text-right">
                ${split.treasury.toLocaleString()}
              </span>
              <span>Liquidity Pool (1.5%)</span>
              <span className="text-right">
                ${split.liquidityPool.toLocaleString()}
              </span>
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Split runs after delivery confirmation. Refunds inside 14
              days roll back the distribution automatically.
            </p>
          </Card>
        </div>

        <div>
          <Card>
            <CardTitle className="text-2xl">Place order</CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Sandbox doesn&apos;t take payment. The order lands at{" "}
              <code>placed</code>; the seller advances it through
              fulfillment from their dashboard.
            </p>
            <form action={placeOrder} className="mt-6 space-y-3">
              <input type="hidden" name="productId" value={product.id} />
              {product.inventoryCount !== null ? (
                <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                  Quantity
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={product.inventoryCount}
                    defaultValue={1}
                    className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-ink"
                  />
                </label>
              ) : (
                <input type="hidden" name="quantity" value="1" />
              )}

              {!current && (
                <>
                  <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                    Your name
                    <input
                      name="buyerName"
                      required
                      placeholder="Full name"
                      className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm normal-case tracking-normal text-ink"
                    />
                  </label>
                  <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                    Email
                    <input
                      name="buyerEmail"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm normal-case tracking-normal text-ink"
                    />
                  </label>
                </>
              )}

              {shipped && (
                <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                  Shipping address
                  <textarea
                    name="shippingAddress"
                    rows={3}
                    required
                    placeholder="Name · street · city, state ZIP · country"
                    className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm normal-case tracking-normal text-ink"
                  />
                </label>
              )}

              <button
                type="submit"
                className="w-full rounded-full py-2.5 text-sm font-medium text-white"
                style={{ backgroundColor: accent }}
                disabled={
                  product.inventoryCount !== null && product.inventoryCount <= 0
                }
              >
                Place order →
              </button>
              <p className="text-[10px] text-ink-faint">
                You&apos;ll land on the order page where you can track
                fulfillment. Real Stripe Connect checkout slots in here
                in production.
              </p>
            </form>
          </Card>

          <p className="mt-4 text-xs text-ink-faint">
            See your past orders under{" "}
            <Link href="/orders" className="text-brand-magenta hover:underline">
              /orders
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
