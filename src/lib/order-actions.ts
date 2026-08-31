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
import { randomUUID } from "crypto";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orders as ordersTable, products as productsTable } from "@/db/schema";
import { orderReader, productReader } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { grossUpForCard } from "@/lib/payments-fees";
import { writeStandardSettlementSplits } from "@/lib/settlement-splits";
import { createMarketplaceReceiptInternal } from "@/lib/invoice-actions";
import { hasValidPayoutDocument } from "@/lib/payout-gate";
import { issueBuildFromSettlement } from "@/lib/voucher-issuance";
import { getAdminUsers } from "@/lib/readers/users";
import {
  ORDER_NEXT_STATUSES,
  type Order,
  type OrderStatus,
} from "@/lib/types";

const HOUSE_FEE_PCT = 0.15;

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * Human-readable order number, BS-ORD-<year>-<seq>.
 *
 * The sequence counts existing orders, which is not collision-safe on
 * its own — two orders placed in the same moment would compute the
 * same seq. `orders.number` carries a unique constraint, so the
 * second insert fails rather than silently issuing a duplicate
 * number; the retry loop in placeOrder recomputes and tries again.
 *
 * A Postgres sequence would be the cleaner answer and is worth doing
 * before volume picks up.
 */
async function nextNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const [row] = await db.select({ n: count() }).from(ordersTable);
  const seq = (Number(row?.n ?? 0) + 1).toString().padStart(4, "0");
  return `BS-ORD-${year}-${seq}`;
}

export async function placeOrder(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const quantity = Math.max(1, Number(formData.get("quantity") ?? "1"));
  const buyerNameInput = String(formData.get("buyerName") ?? "").trim();
  const buyerEmailInput = String(formData.get("buyerEmail") ?? "").trim();
  const shippingAddress =
    String(formData.get("shippingAddress") ?? "").trim() || null;

  const product = await productReader.byId(productId);
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
    id: `ord_${randomUUID()}`,
    number: await nextNumber(),
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
    // Deal-owning admins default to empty — admin populates via the
    // seller's onboarding admin OR the marketplace-category
    // moderator OR a manual assignment. Empty falls back to
    // even-split across platform admins at settlement so no order
    // settles with an empty admin pool.
    adminUserIds: [],
  };

  // Order row and inventory decrement in one transaction. An order
  // recorded without the stock coming down oversells the seller; the
  // reverse loses a sale with nothing to reconcile against.
  //
  // The decrement is guarded in SQL rather than trusting the check
  // above — that check read inventory before this transaction opened,
  // so two buyers hitting the last unit would both pass it.
  await db.transaction(async (tx) => {
    await tx.insert(ordersTable).values({
      id: order.id,
      number: order.number,
      buyerId: order.buyerId,
      buyerEmail: order.buyerEmail,
      buyerName: order.buyerName,
      sellerId: order.sellerId,
      category: order.category,
      status: order.status,
      items: order.items,
      subtotal: order.subtotal,
      houseFee: order.houseFee,
      processingFee: order.processingFee,
      total: order.total,
      stripePaymentIntentId: order.stripePaymentIntentId,
      shippingAddress: order.shippingAddress,
      trackingNumber: order.trackingNumber,
      internalNote: order.internalNote,
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      splitDistributedAt: order.splitDistributedAt,
      adminUserIds: order.adminUserIds,
    });

    if (product.inventoryCount !== null) {
      const res = await tx
        .update(productsTable)
        .set({
          inventoryCount: sql`${productsTable.inventoryCount} - ${quantity}`,
        })
        .where(
          sql`${productsTable.id} = ${productId} AND ${productsTable.inventoryCount} >= ${quantity}`,
        )
        .returning({ id: productsTable.id });
      if (res.length === 0) {
        throw new Error("Not enough inventory");
      }
    }
  });
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

  const order = await orderReader.byId(id);
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
  // Timestamps are set once and never overwritten — the first time an
  // order reached a state is the fact worth keeping, and a status can
  // be revisited.
  await db
    .update(ordersTable)
    .set({
      status: target,
      ...(target === "paid" && !order.paidAt ? { paidAt: now } : {}),
      ...(target === "shipped" && !order.shippedAt ? { shippedAt: now } : {}),
      ...(target === "delivered" && !order.deliveredAt
        ? { deliveredAt: now }
        : {}),
    })
    .where(eq(ordersTable.id, id));

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

  const order = await orderReader.byId(id);
  if (!order) throw new Error("Order not found");
  if (order.sellerId !== current.id && !current.isAdmin) {
    throw new Error("Not your order to manage");
  }
  await db
    .update(ordersTable)
    .set({ trackingNumber: tracking, internalNote: note })
    .where(eq(ordersTable.id, id));
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/profile/seller/orders");
  revalidatePath("/admin/marketplace");
}

export async function distributeOrderSplit(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const order = await orderReader.byId(id);
  if (!order) return;
  if (order.status !== "delivered") return;
  if (order.splitDistributedAt) return;
  const now = new Date().toISOString();

  // Auto-generate the marketplace receipt (payout-authorizing
  // document) before firing the split. Idempotent — creates once,
  // returns existing on re-run. This is what satisfies the payout
  // gate below.
  await createMarketplaceReceiptInternal({
    orderId: order.id,
    orderNumber: order.number,
    sellerId: order.sellerId,
    buyerId: order.buyerId,
    subtotal: order.subtotal,
    processingFee: order.processingFee,
    total: order.total,
    stripePaymentIntentId: order.stripePaymentIntentId,
    itemDescription:
      order.items.length === 1
        ? order.items[0].titleSnapshot
        : `${order.items.length} items on order ${order.number}`,
  });

  if (!(await hasValidPayoutDocument(order.id, "order_settlement"))) {
    throw new Error(
      "Order settlement refused: no marketplace receipt attached. This should have been auto-generated — check /admin/invoices.",
    );
  }

  // Guarded on splitDistributedAt IS NULL so a double-click can't
  // fire the split twice. The second call lands on zero rows.
  const claimed = await db
    .update(ordersTable)
    .set({ splitDistributedAt: now })
    .where(
      sql`${ordersTable.id} = ${id} AND ${ordersTable.splitDistributedAt} IS NULL`,
    )
    .returning({ id: ordersTable.id });
  if (claimed.length === 0) return;

  // Write the full 85 / 12 / 1.5 / 1.5 split via the shared engine.
  // Marketplace orders route the seller as the sole contributor and
  // the admin pool distributes to the deal-owning admins listed on
  // order.adminUserIds. If empty (unseeded / legacy orders), falls
  // back to distributing evenly across all active platform admins
  // so no order settles with an empty admin pool.
  const { users: adminRoster } = await getAdminUsers();
  const activeAdmins = adminRoster.filter((u) => u.suspendedAt === null);
  const activeAdminIds = new Set(activeAdmins.map((u) => u.id));
  const dealAdmins = order.adminUserIds.filter((aid) =>
    activeAdminIds.has(aid),
  );
  const platformAdmins =
    dealAdmins.length > 0 ? dealAdmins : activeAdmins.map((u) => u.id);
  if (platformAdmins.length === 0) {
    // Fall back to the marking-only path so the order still closes
    // even if the admin roster is empty — extreme edge case.
    await logAuditEvent({
      actorUserId: admin.id,
      actorRoleSnapshot: snapshotActorRole(admin),
      action: "contract.revenue_split_recorded",
      resourceKind: "project",
      resourceId: order.id,
      before: { splitDistributedAt: null },
      after: {
        splitDistributedAt: now,
        note: "No platform admins available — split rows NOT written.",
      },
    });
  } else {
    try {
      await writeStandardSettlementSplits({
        gross: Number(order.subtotal),
        sourceKind: "order_settlement",
        sourceId: order.id,
        contractId: null,
        contributors: {
          userIds: [order.sellerId],
        },
        admins: {
          userIds: platformAdmins,
        },
        actorUserId: admin.id,
        noteContext: `Marketplace order ${order.number}`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[order-split] writeStandardSettlementSplits failed for order ${order.id}:`,
        err,
      );
    }
  }

  // $BUILD cascade — uses the canonical 6.087× network fees formula
  // and the 80/16/2/2 split across seller / admin pool / Treasury /
  // LP. Same shape as the cash split, different weights, different
  // basis (network fees only, per the master spreadsheet).
  try {
    await issueBuildFromSettlement({
      gross: Number(order.subtotal),
      cashSourceKind: "order_settlement",
      sourceId: order.id,
      contributors: { userIds: [order.sellerId] },
      admins: { userIds: platformAdmins },
      actorUserId: admin.id,
      noteContext: `$BUILD generation — marketplace order ${order.number}`,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[order-split] issueBuildFromSettlement failed for order ${order.id}:`,
      err,
    );
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/profile/seller/orders");
  revalidatePath("/admin/marketplace");
}
