/**
 * Server actions for marketplace orders.
 *
 *   - placeOrder        : buyer-side. Validates the product is active,
 *                         snapshots title/price into the order line,
 *                         decrements inventory if applicable, redirects
 *                         to /orders/[id].
 *   - advanceOrderStatus: seller-side. Only valid forward transitions
 *                         per ORDER_NEXT_STATUSES. Records timestamps
 *                         when crossing into shipped/delivered.
 *   - distributeOrderSplit: admin-side. Stamps splitDistributedAt once
 *                         the order is delivered. Stand-in for the real
 *                         Stripe Connect transfer batch.
 *   - updateOrderTracking : seller-side. Saves a tracking number +
 *                         optional note without changing status.
 *
 * REPLACE WITH: Drizzle insert + update statements; Stripe Connect
 * payment intent + transfer + payout split. Order-status webhooks
 * from carriers (USPS/FedEx) replace the manual seller transitions
 * for shipped → delivered when the integration lands.
 */
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_PRODUCTS } from "@/lib/mock-data/products";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import { grossUpForCard } from "@/lib/payments-fees";
import {
  ORDER_NEXT_STATUSES,
  type Order,
  type OrderStatus,
} from "@/lib/types";

const HOUSE_FEE_PCT = 0.15;

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function nextNumber(): string {
  // Lightweight, sandbox-only — not collision-safe under real load.
  const year = new Date().getUTCFullYear();
  const seq = (MOCK_ORDERS.length + 1).toString().padStart(4, "0");
  return `BS-ORD-${year}-${seq}`;
}

export async function placeOrder(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const quantity = Math.max(1, Number(formData.get("quantity") ?? "1"));
  const buyerNameInput = String(formData.get("buyerName") ?? "").trim();
  const buyerEmailInput = String(formData.get("buyerEmail") ?? "").trim();
  const shippingAddress =
    String(formData.get("shippingAddress") ?? "").trim() || null;

  const product = MOCK_PRODUCTS.find((p) => p.id === productId);
  if (!product) throw new Error("Product not found");
  if (product.status !== "active") throw new Error("Product not for sale");
  if (
    product.inventoryCount !== null &&
    product.inventoryCount < quantity
  ) {
    throw new Error("Not enough inventory");
  }

  const current = await getCurrentUser();
  const buyerName = current
    ? `${current.firstName ?? ""} ${current.lastName ?? ""}`.trim() ||
      buyerNameInput
    : buyerNameInput;
  const buyerEmail = current?.email ?? buyerEmailInput;
  if (!buyerName || !buyerEmail) {
    throw new Error("Name and email required");
  }

  const unit = Number(product.price);
  const lineTotal = unit * quantity;
  const subtotal = lineTotal;
  const houseFee = subtotal * HOUSE_FEE_PCT;
  // Marketplace checkout is card-only; gross up so the cooperative nets
  // the full subtotal after Stripe takes 2.9% + $0.30. The split engine
  // still runs against `subtotal`, never the grossed total.
  const { gross, processingFee } = grossUpForCard(subtotal);

  const order: Order = {
    id: `ord_${Date.now()}`,
    number: nextNumber(),
    buyerId: current?.id ?? null,
    buyerEmail,
    buyerName,
    sellerId: product.sellerId,
    category: product.category,
    status: "placed",
    items: [
      {
        productId: product.id,
        titleSnapshot: product.title,
        unitPrice: round2(unit),
        quantity,
        lineTotal: round2(lineTotal),
      },
    ],
    subtotal: round2(subtotal),
    houseFee: round2(houseFee),
    processingFee: processingFee.toFixed(2),
    total: gross.toFixed(2),
    stripePaymentIntentId: null,
    shippingAddress,
    trackingNumber: null,
    internalNote: null,
    placedAt: new Date().toISOString(),
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    splitDistributedAt: null,
  };

  // Decrement inventory for inventoried products.
  if (product.inventoryCount !== null) {
    product.inventoryCount -= quantity;
  }

  MOCK_ORDERS.push(order);
  revalidatePath("/store");
  revalidatePath("/orders");
  revalidatePath("/profile/seller/orders");
  revalidatePath("/admin/marketplace");
  redirect(`/orders/${order.id}`);
}

export async function advanceOrderStatus(formData: FormData) {
  const current = await getCurrentUser();
  if (!current) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "");
  const target = String(formData.get("status") ?? "") as OrderStatus;

  const order = MOCK_ORDERS.find((o) => o.id === id);
  if (!order) throw new Error("Order not found");
  // Only the seller (or an admin) can advance status.
  if (order.sellerId !== current.id && !current.isAdmin) {
    throw new Error("Not your order to manage");
  }
  const validNext = ORDER_NEXT_STATUSES[order.status];
  if (!validNext.includes(target)) {
    throw new Error(`Cannot move from ${order.status} to ${target}`);
  }

  const now = new Date().toISOString();
  order.status = target;
  if (target === "paid" && !order.paidAt) order.paidAt = now;
  if (target === "shipped" && !order.shippedAt) order.shippedAt = now;
  if (target === "delivered" && !order.deliveredAt) order.deliveredAt = now;

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/profile/seller/orders");
  revalidatePath("/admin/marketplace");
}

export async function updateOrderTracking(formData: FormData) {
  const current = await getCurrentUser();
  if (!current) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "");
  const tracking = String(formData.get("trackingNumber") ?? "").trim() || null;
  const note = String(formData.get("internalNote") ?? "").trim() || null;

  const order = MOCK_ORDERS.find((o) => o.id === id);
  if (!order) throw new Error("Order not found");
  if (order.sellerId !== current.id && !current.isAdmin) {
    throw new Error("Not your order to manage");
  }
  order.trackingNumber = tracking;
  order.internalNote = note;
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/profile/seller/orders");
  revalidatePath("/admin/marketplace");
}

export async function distributeOrderSplit(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const order = MOCK_ORDERS.find((o) => o.id === id);
  if (!order) return;
  if (order.status !== "delivered") return;
  if (order.splitDistributedAt) return;
  const now = new Date().toISOString();
  order.splitDistributedAt = now;

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "contract.revenue_split_recorded",
    resourceKind: "project",
    resourceId: order.id,
    before: { splitDistributedAt: null },
    after: {
      splitDistributedAt: now,
      sellerId: order.sellerId,
      subtotal: order.subtotal,
      houseFee: order.houseFee,
    },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/profile/seller/orders");
  revalidatePath("/admin/marketplace");
}
