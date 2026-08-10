/**
 * Invoice + Receipt server actions.
 *
 * Four flows, one primitive:
 *   1. createInternalInvoice — talent bills the coop for their work
 *      on a specific project. Owner = talent user.
 *   2. approveInternalInvoice — admin flips status "issued" → "received",
 *      locking the invoice into the contributor pool at settlement.
 *   3. generateExternalInvoice — admin aggregates a project's approved
 *      internal invoices, grosses up by / 0.85 to produce the external
 *      client-facing invoice. sourceInvoiceIds captures the trail.
 *   4. markExternalInvoicePaid — admin marks payment received on an
 *      external invoice. This is the moment the payout gate opens for
 *      settlement to fire.
 *
 * Plus receipt paths:
 *   5. createMarketplaceReceipt — auto-called from order fulfillment
 *      to document the completed transaction. Born at "received".
 *   6. createRetroactiveReceipt — admin escape hatch to close an
 *      audit gap when the invoice flow was skipped.
 *
 * Payout gate: `hasValidPayoutDocument(sourceId)` returns true when
 * a project has at least one received coop_to_client invoice OR when
 * an order/project has an attached receipt. Settlement actions call
 * this before firing splits.
 *
 * SANDBOX→LIVE swap history:
 *   - Pre-Beta cutover: read/write MOCK_INVOICES + MOCK_PROJECTS
 *     in-memory arrays.
 *   - Beta cutover (this file): reads/writes Drizzle invoices +
 *     projects tables against live Postgres. createMarketplaceReceiptInternal
 *     is now async (was sync) — see caller updates in order-actions.ts.
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invoices, projects } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import {
  COOP_RECIPIENT_ID,
  type Invoice,
  type InvoiceLineItem,
} from "@/lib/types";

// ────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────

function nextInvoiceNumber(prefix: string): string {
  const year = new Date().getUTCFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FM-${prefix}-${year}-${rand.toString().padStart(4, "0")}`;
}

function nextInvoiceId(prefix: string): string {
  return `inv_${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function nextLineItemId(): string {
  return `li_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function parseAmount(raw: string): string {
  const trimmed = raw.trim();
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Amount "${raw}" is not a positive finite number.`);
  }
  return parsed.toFixed(2);
}

function parseLineItems(formData: FormData): InvoiceLineItem[] {
  const descriptions = formData.getAll("lineDescription").map(String);
  const amounts = formData.getAll("lineAmount").map(String);
  if (descriptions.length === 0) {
    throw new Error("At least one line item is required.");
  }
  if (descriptions.length !== amounts.length) {
    throw new Error("Line-item descriptions and amounts must match.");
  }
  return descriptions.map((desc, i) => ({
    id: nextLineItemId(),
    description: desc.trim() || "Line item",
    amount: parseAmount(amounts[i] ?? "0"),
  }));
}

function sumLineItems(items: InvoiceLineItem[]): number {
  return items.reduce((sum, li) => sum + Number(li.amount), 0);
}

// ────────────────────────────────────────────────────────────────
//  Internal invoice (talent → coop)
// ────────────────────────────────────────────────────────────────

/**
 * Talent cuts an internal invoice against a specific project. Any
 * signed-in user can create — the recipient is always the coop.
 * Status starts as "issued" (submitted for admin review). Draft
 * support could be added later; MVP goes straight from create →
 * awaiting approval.
 */
export async function createInternalInvoice(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to cut an invoice.");

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Pick a project to invoice against.");
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw new Error("Project not found.");

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const lineItems = parseLineItems(formData);
  const subtotal = sumLineItems(lineItems).toFixed(2);

  const now = new Date().toISOString();
  const row: Invoice = {
    id: nextInvoiceId("int"),
    direction: "talent_to_coop",
    documentKind: "invoice",
    contractId: projectId,
    sourceRefId: null,
    sourceInvoiceIds: null,
    issuerId: user.id,
    recipientId: COOP_RECIPIENT_ID,
    number: nextInvoiceNumber("TALENT"),
    clientToken: null,
    status: "issued",
    paymentMethod: null,
    acceptsCard: false,
    lineItems,
    subtotal,
    processingFee: "0.00",
    total: subtotal,
    issuedAt: now,
    dueAt: null,
    paidAt: null,
    paidAmount: "0.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(invoices).values(row);

  logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "quote.created", // reuse existing verb — see note below
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: null,
    after: {
      direction: "talent_to_coop",
      projectId,
      total: subtotal,
      lineItemCount: lineItems.length,
    },
    reason: `Internal invoice from ${user.firstName} against ${project.title}`,
  });
  // NOTE: reusing quote.created verb as a stopgap because the audit-log
  // enum doesn't have an invoice-specific verb yet. Adding
  // invoice.created / invoice.approved / invoice.paid verbs is a
  // follow-on cleanup — the resource kind + payload disambiguate for
  // now, and the audit trail is not lost.

  revalidatePath("/admin/invoices");
  revalidatePath("/profile/invoices");
  revalidatePath(`/admin/contracts/${projectId}/settle`);
}

/**
 * Admin approves an internal invoice, locking it into the contributor
 * pool at settlement. Idempotent — refuses to re-approve an already-
 * received invoice.
 */
export async function approveInternalInvoice(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Invoice id is required.");
  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) throw new Error("Invoice not found.");
  if (row.direction !== "talent_to_coop") {
    throw new Error("Only internal invoices are approved through this action.");
  }
  if (row.status === "received") {
    throw new Error("Invoice already approved.");
  }

  const before = { status: row.status };
  const paidAt = new Date().toISOString();
  await db
    .update(invoices)
    .set({
      status: "received",
      paidAt,
      paidAmount: row.total,
      updatedAt: paidAt,
    })
    .where(eq(invoices.id, id));

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.approved",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before,
    after: { status: "received", paidAt },
    reason: `Admin approved internal invoice ${row.number}`,
  });

  revalidatePath("/admin/invoices");
  revalidatePath("/profile/invoices");
  if (row.contractId) {
    revalidatePath(`/admin/contracts/${row.contractId}/settle`);
  }
}

// ────────────────────────────────────────────────────────────────
//  External invoice (coop → client, aggregating internals)
// ────────────────────────────────────────────────────────────────

/**
 * Admin aggregates approved internal invoices on a project and
 * generates the external client-facing invoice. Total = sum of
 * internal totals / 0.85 (grosses up so the 15% network fee lands
 * on top of the internal sum).
 *
 * Blocks generation if any of the referenced internals aren't
 * status = "received", so the client invoice always reflects
 * approved contributor billing.
 */
export async function generateExternalInvoice(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Project id is required.");
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw new Error("Project not found.");

  const clientRecipientId = String(
    formData.get("clientRecipientId") ?? "",
  ).trim();
  if (!clientRecipientId) {
    throw new Error("Client recipient id/label is required.");
  }

  const internals = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.contractId, projectId),
        eq(invoices.direction, "talent_to_coop"),
        eq(invoices.status, "received"),
      ),
    );
  if (internals.length === 0) {
    throw new Error(
      "No approved internal invoices on this project. Approve at least one internal invoice before generating the external.",
    );
  }

  const internalSum = internals.reduce((s, i) => s + Number(i.total), 0);
  // Gross up: external total = internal sum / 0.85 so that 85% of
  // the external lands back on the contributor pool covering the
  // internal invoices exactly.
  const externalTotal = internalSum / 0.85;
  const now = new Date().toISOString();

  const lineItems: InvoiceLineItem[] = internals.map((i) => ({
    id: nextLineItemId(),
    description: `Contributor billing — ${i.number} (${i.issuerId})`,
    amount: i.total,
  }));
  // Add the network-fee line to make the gross-up transparent to the client.
  lineItems.push({
    id: nextLineItemId(),
    description: "Network fee (15% — admin coordination + treasury + LP)",
    amount: (externalTotal - internalSum).toFixed(2),
  });

  const row: Invoice = {
    id: nextInvoiceId("ext"),
    direction: "coop_to_client",
    documentKind: "invoice",
    contractId: projectId,
    sourceRefId: null,
    sourceInvoiceIds: internals.map((i) => i.id),
    issuerId: admin.id,
    recipientId: clientRecipientId,
    number: nextInvoiceNumber(""),
    clientToken: `tok_ext_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    status: "issued",
    paymentMethod: "ach_mercury",
    acceptsCard: false,
    lineItems,
    subtotal: externalTotal.toFixed(2),
    processingFee: "0.00",
    total: externalTotal.toFixed(2),
    issuedAt: now,
    dueAt: null,
    paidAt: null,
    paidAmount: "0.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes: `Aggregates ${internals.length} approved internal invoice${
      internals.length === 1 ? "" : "s"
    }.`,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(invoices).values(row);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.created",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: null,
    after: {
      direction: "coop_to_client",
      projectId,
      externalTotal: row.total,
      internalCount: internals.length,
      internalSum: internalSum.toFixed(2),
    },
    reason: `External invoice aggregating ${internals.length} internal invoice${
      internals.length === 1 ? "" : "s"
    } on ${project.title}`,
  });

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/contracts/${projectId}/settle`);
}

/**
 * Admin logs payment received on an external (coop_to_client) invoice.
 * This is the moment the payout gate opens for settlement to fire —
 * once a coop_to_client invoice is `received`, hasValidPayoutDocument()
 * returns true and the settle page will accept a distribution.
 *
 * Supports partial payments: if paidAmount < total, status flips to
 * `partially_received` and a subsequent log-payment call can top it up
 * to full receipt.
 *
 * Idempotent-refusing: rejects if already `received` (use a new invoice
 * for corrections rather than re-marking) or `void`.
 */
export async function markExternalInvoicePaid(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Invoice id is required.");

  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) throw new Error("Invoice not found.");
  if (row.direction !== "coop_to_client") {
    throw new Error(
      "Only external (coop_to_client) invoices are marked paid through this action.",
    );
  }
  if (row.status === "received") {
    throw new Error("Invoice already fully received.");
  }
  if (row.status === "void") {
    throw new Error("Invoice is void; cannot log payment against it.");
  }

  const rawAmount = String(formData.get("amount") ?? "").trim();
  const total = Number(row.total);
  const alreadyPaid = Number(row.paidAmount);
  const remaining = Math.max(0, total - alreadyPaid);
  const paymentAmount = rawAmount ? Number(rawAmount) : remaining;
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Payment amount must be a positive number.");
  }
  if (paymentAmount > remaining + 0.01) {
    throw new Error(
      `Payment amount ${paymentAmount.toFixed(2)} exceeds remaining balance ${remaining.toFixed(2)}.`,
    );
  }

  const newPaidAmount = alreadyPaid + paymentAmount;
  const nowFullyPaid = Math.abs(newPaidAmount - total) < 0.01;
  const newStatus = nowFullyPaid ? "received" : "partially_received";

  const method = (String(formData.get("method") ?? "").trim() ||
    null) as
    | "ach_mercury"
    | "wire_mercury"
    | "cc_stripe"
    | "check"
    | "other"
    | null;
  const externalRef = String(formData.get("externalRef") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim();

  const now = new Date().toISOString();
  const paidAt = nowFullyPaid ? now : row.paidAt;

  const notesAppendix = notes
    ? `${row.notes ? row.notes + " · " : ""}Payment ${paymentAmount.toFixed(2)} on ${now.slice(0, 10)}: ${notes}`
    : row.notes;

  await db
    .update(invoices)
    .set({
      status: newStatus,
      paidAt,
      paidAmount: newPaidAmount.toFixed(2),
      paymentMethod: method ?? row.paymentMethod,
      mercuryReference:
        method === "ach_mercury" || method === "wire_mercury"
          ? externalRef ?? row.mercuryReference
          : row.mercuryReference,
      stripePaymentIntentId:
        method === "cc_stripe"
          ? externalRef ?? row.stripePaymentIntentId
          : row.stripePaymentIntentId,
      notes: notesAppendix,
      updatedAt: now,
    })
    .where(eq(invoices.id, id));

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.approved",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: { status: row.status, paidAmount: row.paidAmount },
    after: {
      status: newStatus,
      paidAmount: newPaidAmount.toFixed(2),
      paymentMethod: method ?? row.paymentMethod,
      externalRef,
    },
    reason: `Admin logged payment ${paymentAmount.toFixed(2)} on external invoice ${row.number}${nowFullyPaid ? " (fully received; payout gate now open)" : " (partial receipt)"}`,
  });

  revalidatePath("/admin/invoices");
  if (row.contractId) {
    revalidatePath(`/admin/contracts/${row.contractId}/settle`);
    revalidatePath(`/admin/contracts/${row.contractId}/ledger`);
  }
}

// ────────────────────────────────────────────────────────────────
//  Receipt flows
// ────────────────────────────────────────────────────────────────

/**
 * Auto-create a receipt for a completed marketplace order. Called
 * from `distributeOrderSplit` (Tier 25) as the payout-authorizing
 * document. Idempotent — refuses to duplicate a receipt for the same
 * order id.
 *
 * NOTE: became async in the Beta cutover (was sync). Callers must
 * now await.
 */
export async function createMarketplaceReceiptInternal(input: {
  orderId: string;
  orderNumber: string;
  sellerId: string;
  buyerId: string | null;
  subtotal: string;
  processingFee: string;
  total: string;
  stripePaymentIntentId: string | null;
  itemDescription: string;
}): Promise<Invoice | null> {
  const [existing] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.direction, "marketplace_receipt"),
        eq(invoices.sourceRefId, input.orderId),
      ),
    )
    .limit(1);
  if (existing) return existing as Invoice;

  const now = new Date().toISOString();
  const row: Invoice = {
    id: nextInvoiceId("rcpt"),
    direction: "marketplace_receipt",
    documentKind: "receipt",
    contractId: null,
    sourceRefId: input.orderId,
    sourceInvoiceIds: null,
    issuerId: input.sellerId,
    recipientId: input.buyerId ?? `buyer_${input.orderId}`,
    number: `FM-RCPT-${new Date().getUTCFullYear()}-${Math.floor(
      Math.random() * 9000,
    ) + 1000}`,
    clientToken: null,
    status: "received",
    paymentMethod: input.stripePaymentIntentId ? "cc_stripe" : null,
    acceptsCard: !!input.stripePaymentIntentId,
    lineItems: [
      {
        id: nextLineItemId(),
        description: input.itemDescription,
        amount: input.subtotal,
      },
    ],
    subtotal: input.subtotal,
    processingFee: input.processingFee,
    total: input.total,
    issuedAt: now,
    dueAt: null,
    paidAt: now,
    paidAmount: input.total,
    mercuryReference: null,
    stripePaymentIntentId: input.stripePaymentIntentId,
    notes: `Auto-generated receipt for order ${input.orderNumber}.`,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(invoices).values(row);
  return row;
}

/**
 * Admin-created retroactive receipt for closing an audit gap where
 * the invoice flow was skipped. Rare-path escape hatch.
 */
export async function createRetroactiveReceipt(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim() || null;
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const rationale = String(formData.get("rationale") ?? "").trim();
  const recipientId = String(formData.get("recipientId") ?? "").trim();

  if (!description) throw new Error("Description is required.");
  if (!rationale) {
    throw new Error(
      "Rationale is required. Retroactive receipts need a written justification in the audit trail.",
    );
  }
  if (!recipientId) throw new Error("Recipient id is required.");

  const now = new Date().toISOString();
  const row: Invoice = {
    id: nextInvoiceId("rcpt_retro"),
    direction: "retroactive_receipt",
    documentKind: "receipt",
    contractId: projectId,
    sourceRefId: projectId,
    sourceInvoiceIds: null,
    issuerId: admin.id,
    recipientId,
    number: `FM-RCPT-RETRO-${new Date().getUTCFullYear()}-${Math.floor(
      Math.random() * 9000,
    ) + 1000}`,
    clientToken: null,
    status: "received",
    paymentMethod: null,
    acceptsCard: false,
    lineItems: [
      { id: nextLineItemId(), description, amount },
    ],
    subtotal: amount,
    processingFee: "0.00",
    total: amount,
    issuedAt: now,
    dueAt: null,
    paidAt: now,
    paidAmount: amount,
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes: `Retroactive rectification: ${rationale}`,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(invoices).values(row);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.created",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: null,
    after: {
      direction: "retroactive_receipt",
      projectId,
      amount,
      recipientId,
    },
    reason: `Retroactive receipt: ${rationale}`,
  });

  revalidatePath("/admin/invoices");
}
