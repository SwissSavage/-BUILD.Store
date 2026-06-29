/**
 * Buyer order history (Phase 2.1 sandbox).
 *
 * Lists every order whose `buyerId` matches the signed-in user. Guest
 * orders (no buyerId) intentionally don't surface here — those buyers
 * land on /orders/[id] directly via the magic-link confirmation email
 * in production. Sandbox just hides them.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MARKETPLACE_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  publicName,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { NotificationStrip } from "@/components/NotificationStrip";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/orders");

  const mine = MOCK_ORDERS.filter((o) => o.buyerId === user.id).sort(
    (a, b) => b.placedAt.localeCompare(a.placedAt),
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <CardEyebrow>Marketplace</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">My orders</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Everything you&apos;ve ordered through the cooperative store. The
        seller advances each order through fulfillment from their side;
        you get notified at every transition in production.
      </p>

      <NotificationStrip
        userId={user.id}
        kinds={["order_status", "order_tracking"]}
        surfaceLabel="Orders"
      />

      {mine.length === 0 ? (
        <Card className="mt-8">
          <p className="text-sm text-ink-muted">
            No orders yet.{" "}
            <Link href="/store" className="text-brand-magenta hover:underline">
              Browse the store →
            </Link>
          </p>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {mine.map((o) => {
            const seller = MOCK_USERS.find((u) => u.id === o.sellerId);
            return (
              <Link key={o.id} href={`/orders/${o.id}`} className="block">
                <Card className="transition-colors hover:border-brand-magenta">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardEyebrow>
                        {MARKETPLACE_CATEGORY_LABELS[o.category]} ·{" "}
                        {o.number}
                      </CardEyebrow>
                      <CardTitle className="mt-1">
                        {o.items.map((i) => i.titleSnapshot).join(" · ")}
                      </CardTitle>
                      <p className="mt-1 text-xs text-ink-muted">
                        From {seller ? publicName(seller) : "a cooperator"} ·
                        Placed {new Date(o.placedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl font-semibold">
                        ${Number(o.total).toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs text-ink-muted">
                        {ORDER_STATUS_LABELS[o.status]}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
