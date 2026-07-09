/**
 * Admin: marketplace vetting queue (Phase 2.1 sandbox preview).
 *
 * Two queues in one page:
 *   1. Seller applications — approve or reject a member's request to sell
 *      in a set of categories. Approval is the gate that lets them submit
 *      product for review.
 *   2. Product reviews — products submitted with status="pending_review"
 *      need an admin pass before they appear on /store.
 *
 * Mutations write to the in-memory mock arrays. REPLACE WITH Drizzle
 * UPDATE on `seller_applications.status` + `products.status`, plus an
 * audit-log row per decision so the cooperative has a paper trail on
 * who approved what.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_SELLER_APPLICATIONS } from "@/lib/mock-data/seller-applications";
import { MOCK_PRODUCTS } from "@/lib/mock-data/products";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MARKETPLACE_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  SELLER_APPLICATION_STATUS_LABELS,
  adminName,
  type OrderStatus,
} from "@/lib/types";
import { distributeOrderSplit } from "@/lib/order-actions";
import { previewOrderSplit } from "@/lib/order-splits";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

async function decideApplication(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as "approved" | "rejected";
  const note = String(formData.get("note") ?? "").trim() || null;

  const app = MOCK_SELLER_APPLICATIONS.find((a) => a.id === id);
  if (!app) return;
  app.status = decision;
  app.reviewedBy = admin.id;
  app.reviewedAt = new Date().toISOString();
  app.adminNote = note;
  revalidatePath("/admin/marketplace");
  revalidatePath("/admin");
  revalidatePath("/profile/seller");
}

async function decideProduct(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as "active" | "rejected";
  const note = String(formData.get("note") ?? "").trim() || null;

  const prod = MOCK_PRODUCTS.find((p) => p.id === id);
  if (!prod) return;
  prod.status = decision;
  prod.adminNote = note;
  prod.updatedAt = new Date().toISOString();
  // reviewedBy isn't on Product today; audit table will carry it in prod.
  void admin;
  revalidatePath("/admin/marketplace");
  revalidatePath("/admin");
  revalidatePath("/store");
}

export default async function AdminMarketplacePage() {
  await requireAdmin();

  const pendingApps = MOCK_SELLER_APPLICATIONS.filter(
    (a) => a.status === "pending",
  );
  const reviewedApps = MOCK_SELLER_APPLICATIONS.filter(
    (a) => a.status !== "pending",
  );
  const pendingProducts = MOCK_PRODUCTS.filter(
    (p) => p.status === "pending_review",
  );
  const activeProducts = MOCK_PRODUCTS.filter((p) => p.status === "active");

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin home
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Marketplace</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Vetting queue for the cooperative store. Approve sellers before
        they can submit listings; approve each listing before it goes
        public. Rejections keep the record for audit — the member can
        resubmit after addressing the note.
      </p>

      {/* Seller applications */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Seller applications ({pendingApps.length} pending)
        </h2>
        {pendingApps.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            No applications waiting. Member submissions land here from{" "}
            <code>/profile/seller</code>.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {pendingApps.map((app) => {
              const user = MOCK_USERS.find((u) => u.id === app.userId);
              return (
                <Card key={app.id}>
                  <CardEyebrow>
                    {app.requestedCategories
                      .map((c) => MARKETPLACE_CATEGORY_LABELS[c])
                      .join(" + ")}
                  </CardEyebrow>
                  <CardTitle className="mt-2">
                    {user ? adminName(user) : "Unknown member"}
                  </CardTitle>
                  <p className="mt-1 text-xs text-ink-faint">
                    @{user?.handle} · Submitted{" "}
                    {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-3 text-sm text-ink-muted">{app.pitch}</p>

                  <form action={decideApplication} className="mt-4 space-y-3">
                    <input type="hidden" name="id" value={app.id} />
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Admin note (optional — shown to member on decision)"
                      className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="approved"
                        className="rounded-full bg-brand-green px-4 py-1.5 text-xs font-medium text-brand-white hover:opacity-90"
                      >
                        Approve
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="rejected"
                        className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta"
                      >
                        Reject
                      </button>
                    </div>
                  </form>
                </Card>
              );
            })}
          </div>
        )}

        {reviewedApps.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="p-4 text-left">Member</th>
                  <th className="p-4 text-left">Categories</th>
                  <th className="p-4 text-left">Decision</th>
                  <th className="p-4 text-left">Note</th>
                  <th className="p-4 text-left">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {reviewedApps.map((app) => {
                  const user = MOCK_USERS.find((u) => u.id === app.userId);
                  return (
                    <tr
                      key={app.id}
                      className="border-t border-[var(--surface-border)]"
                    >
                      <td className="p-4">
                        {user ? adminName(user) : "—"}
                      </td>
                      <td className="p-4 text-ink-muted">
                        {app.requestedCategories
                          .map((c) => MARKETPLACE_CATEGORY_LABELS[c])
                          .join(", ")}
                      </td>
                      <td className="p-4">
                        {SELLER_APPLICATION_STATUS_LABELS[app.status]}
                      </td>
                      <td className="p-4 text-xs text-ink-muted">
                        {app.adminNote ?? "—"}
                      </td>
                      <td className="p-4 text-ink-muted">
                        {app.reviewedAt
                          ? new Date(app.reviewedAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Product reviews */}
      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">
          Product reviews ({pendingProducts.length} pending)
        </h2>
        {pendingProducts.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            No listings waiting. Approved sellers can submit product via
            <code>/profile/seller</code> in production; sandbox uses the
            status column on MOCK_PRODUCTS.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {pendingProducts.map((p) => {
              const seller = MOCK_USERS.find((u) => u.id === p.sellerId);
              return (
                <Card key={p.id}>
                  <CardEyebrow>
                    {MARKETPLACE_CATEGORY_LABELS[p.category]} ·{" "}
                    {PRODUCT_STATUS_LABELS[p.status]}
                  </CardEyebrow>
                  <CardTitle className="mt-2">{p.title}</CardTitle>
                  <p className="mt-1 text-xs text-ink-faint">
                    ${Number(p.price).toLocaleString()} · Seller:{" "}
                    {seller ? adminName(seller) : "unknown"}
                  </p>
                  <p className="mt-3 text-sm text-ink-muted">{p.description}</p>

                  <form action={decideProduct} className="mt-4 space-y-3">
                    <input type="hidden" name="id" value={p.id} />
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Admin note (optional — required on reject)"
                      className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="active"
                        className="rounded-full bg-brand-green px-4 py-1.5 text-xs font-medium text-brand-white hover:opacity-90"
                      >
                        Approve → Publish
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="rejected"
                        className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta"
                      >
                        Reject
                      </button>
                    </div>
                  </form>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-[var(--surface-border)] p-4 text-xs text-ink-muted">
          {activeProducts.length} active listings live on <code>/store</code>.
          Stripe Connect 85/15 application fee applies at checkout in
          production — sandbox doesn&apos;t process payments yet.
        </div>
      </section>

      <AdminOrdersSection />
    </div>
  );
}

const ORDER_LANES: OrderStatus[] = [
  "placed",
  "paid",
  "fulfilling",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

/**
 * Marketplace orders overview. Lets admin see the whole pipeline and
 * force-distribute the split on delivered orders (stand-in for the
 * Stripe Connect transfer batch). Admins do NOT advance fulfillment
 * status here — that's the seller's job — but they can intervene from
 * the order detail page if they need to.
 */
function AdminOrdersSection() {
  const orders = [...MOCK_ORDERS].sort(
    (a, b) => b.placedAt.localeCompare(a.placedAt),
  );
  const grossDelivered = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.subtotal), 0);
  const undistributed = orders.filter(
    (o) => o.status === "delivered" && !o.splitDistributedAt,
  );
  const houseFeeAccrued = orders
    .filter(
      (o) => o.splitDistributedAt || o.status === "delivered",
    )
    .reduce((sum, o) => sum + Number(o.houseFee), 0);

  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-semibold">Orders</h2>
      <p className="mt-2 max-w-3xl text-sm text-ink-muted">
        End-to-end view of the marketplace pipeline. Sellers advance
        fulfillment from{" "}
        <code>/profile/seller/orders</code> or directly on each order
        page; admin runs the split distribution once delivered.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Card>
          <CardEyebrow>Delivered (subtotal)</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            ${Math.round(grossDelivered).toLocaleString()}
          </CardTitle>
        </Card>
        <Card>
          <CardEyebrow>House fee accrued</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            ${Math.round(houseFeeAccrued).toLocaleString()}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            15% of delivered + distributed orders
          </p>
        </Card>
        <Card>
          <CardEyebrow>Awaiting distribution</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            {undistributed.length}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            Delivered, split not yet run
          </p>
        </Card>
      </div>

      {ORDER_LANES.filter((s) => orders.some((o) => o.status === s)).map(
        (status) => {
          const rows = orders.filter((o) => o.status === status);
          return (
            <div key={status} className="mt-6">
              <h3 className="text-xs uppercase tracking-wider text-ink-muted">
                {ORDER_STATUS_LABELS[status]} ({rows.length})
              </h3>
              <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="p-4 text-left">Order</th>
                      <th className="p-4 text-left">Buyer</th>
                      <th className="p-4 text-left">Seller</th>
                      <th className="p-4 text-left">Category</th>
                      <th className="p-4 text-right">Subtotal</th>
                      <th className="p-4 text-left">Split (S/A/T+LP)</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => {
                      const seller = MOCK_USERS.find(
                        (u) => u.id === o.sellerId,
                      );
                      const split = previewOrderSplit(Number(o.subtotal));
                      return (
                        <tr
                          key={o.id}
                          className="border-t border-[var(--surface-border)]"
                        >
                          <td className="p-4">
                            <Link
                              href={`/orders/${o.id}`}
                              className="font-medium text-brand-magenta hover:underline"
                            >
                              {o.number}
                            </Link>
                            <div className="text-xs text-ink-muted">
                              {o.items[0]?.titleSnapshot}
                              {o.items.length > 1 &&
                                ` (+${o.items.length - 1})`}
                            </div>
                          </td>
                          <td className="p-4 text-ink-muted">
                            <div>{o.buyerName}</div>
                            <div className="text-xs text-ink-faint">
                              {o.buyerEmail}
                            </div>
                          </td>
                          <td className="p-4 text-ink-muted">
                            {seller ? adminName(seller) : "—"}
                          </td>
                          <td className="p-4 text-ink-muted">
                            {MARKETPLACE_CATEGORY_LABELS[o.category]}
                          </td>
                          <td className="p-4 text-right">
                            ${Number(o.subtotal).toLocaleString()}
                          </td>
                          <td className="p-4 text-xs text-ink-muted">
                            ${split.seller.toLocaleString()} /{" "}
                            ${split.admin.toLocaleString()} /{" "}
                            ${(split.treasury + split.liquidityPool).toLocaleString()}
                          </td>
                          <td className="p-4 text-right">
                            {o.status === "delivered" &&
                              !o.splitDistributedAt && (
                                <form action={distributeOrderSplit}>
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={o.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
                                    style={{ backgroundColor: "#D828A0" }}
                                  >
                                    Run split
                                  </button>
                                </form>
                              )}
                            {o.splitDistributedAt && (
                              <span className="text-[11px] text-brand-green">
                                Distributed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        },
      )}
    </section>
  );
}
