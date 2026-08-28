"use server";

/**
 * Task #63 — Server actions for contributor payout methods.
 *
 * Contributors manage their own rails at /profile/payouts. Admins can
 * confirm assisted-rail sends from /admin/payments.
 *
 * SECURITY POSTURE
 *   - Every action re-derives the acting user from the session. A
 *     userId is never accepted from the client; a hand-crafted POST
 *     cannot register a payout method on someone else's account.
 *   - Admin-only actions call requireAdmin().
 *   - Raw bank credentials never reach these actions. Plaid and Stripe
 *     hand back tokens through their own callbacks.
 */
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payoutMethods } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import {
  RAIL_SPECS,
  externalRefForRail,
  validateRailFields,
  verifyPayoutMethod,
} from "@/lib/payments";
import type { PayoutMethod, PayoutRail } from "@/lib/payments";
import { logAuditEvent, snapshotActorRole } from "@/lib/mock-data/audit-log";

/** Field keys that are safe to persist in the metadata jsonb column. */
const METADATA_SAFE_KEYS = new Set([
  "bankName",
  "mailingAddress",
  "plaidItemId",
  "chainId",
]);

function rowToMethod(row: typeof payoutMethods.$inferSelect): PayoutMethod {
  return {
    id: row.id,
    userId: row.userId,
    rail: row.rail as PayoutRail,
    displayLabel: row.displayLabel,
    externalRef: row.externalRef,
    metadata: row.metadata ?? null,
    isDefault: row.isDefault,
    verifiedAt: row.verifiedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Read the signed-in contributor's registered methods. */
export async function listMyPayoutMethods(): Promise<PayoutMethod[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const rows = await db
    .select()
    .from(payoutMethods)
    .where(eq(payoutMethods.userId, user.id));

  return rows.map(rowToMethod);
}

/**
 * Register a new payout method for the signed-in contributor.
 *
 * Stripe and Plaid don't come through here — they land via their own
 * provider callbacks, which supply the external ref we can't collect
 * on a form.
 */
export async function addPayoutMethod(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to add a payout method");

  const rail = String(formData.get("rail") ?? "") as PayoutRail;
  if (!(rail in RAIL_SPECS)) {
    throw new Error("Unknown payout rail");
  }
  if (rail === "stripe_connect" || rail === "plaid_ach") {
    throw new Error(
      `${rail} is set up through the provider's own flow, not this form.`,
    );
  }

  // Collect only the keys this rail's spec declares. Anything else the
  // client posted is discarded rather than persisted.
  const values: Record<string, string> = {};
  for (const field of RAIL_SPECS[rail].fields) {
    values[field.key] = String(formData.get(field.key) ?? "");
  }

  const problems = validateRailFields(rail, values);
  if (problems.length > 0) {
    throw new Error(problems.join(" "));
  }

  const externalRef = externalRefForRail(rail, values);
  if (!externalRef) {
    throw new Error("Could not determine a destination for this rail.");
  }

  // Crypto is irreversible — require the acknowledgment explicitly on
  // the server, not just as a disabled submit button in the UI.
  if (rail === "crypto_wallet" && formData.get("ackIrreversible") !== "on") {
    throw new Error(
      "You must acknowledge that on-chain transfers cannot be reversed.",
    );
  }

  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (METADATA_SAFE_KEYS.has(key) && value.trim()) {
      metadata[key] = value.trim();
    }
  }

  const existing = await db
    .select()
    .from(payoutMethods)
    .where(eq(payoutMethods.userId, user.id));

  const now = new Date().toISOString();
  const id = `pm_${randomUUID()}`;

  await db.insert(payoutMethods).values({
    id,
    userId: user.id,
    rail,
    displayLabel:
      String(formData.get("displayLabel") ?? "").trim() ||
      RAIL_SPECS[rail].rail.replace(/_/g, " "),
    externalRef,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    // First method a contributor registers becomes their default.
    isDefault: existing.length === 0,
    verifiedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  });

  logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "payout_method.added",
    resourceKind: "payout_method",
    resourceId: id,
    before: null,
    after: { rail, isDefault: existing.length === 0 },
  });

  revalidatePath("/profile/payouts");
}

/**
 * Make one method the settlement default, clearing the previous one.
 *
 * The partial unique index in migration 0013 enforces one default per
 * user at the database level, so the clear must land before the set.
 * Both statements run inside a transaction — a half-applied swap would
 * leave a contributor with either zero or two defaults, and the
 * settlement engine treats both as unpayable.
 */
export async function setDefaultPayoutMethod(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to change your payout method");

  const methodId = String(formData.get("methodId") ?? "");

  const [target] = await db
    .select()
    .from(payoutMethods)
    .where(
      and(eq(payoutMethods.id, methodId), eq(payoutMethods.userId, user.id)),
    )
    .limit(1);

  if (!target) throw new Error("Payout method not found");
  if (!target.verifiedAt) {
    throw new Error("Verify this method before making it your default.");
  }

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx
      .update(payoutMethods)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(payoutMethods.userId, user.id));
    await tx
      .update(payoutMethods)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(payoutMethods.id, methodId));
  });

  logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "payout_method.default_changed",
    resourceKind: "payout_method",
    resourceId: methodId,
    before: null,
    after: { rail: target.rail },
  });

  revalidatePath("/profile/payouts");
}

/**
 * Ask the rail whether this destination is reachable, and record the
 * answer. Rails differ in what they can confirm — the driver's
 * `detail` string is persisted verbatim so the contributor sees an
 * honest explanation rather than a bare red X.
 */
export async function verifyMyPayoutMethod(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to verify a payout method");

  const methodId = String(formData.get("methodId") ?? "");
  const [row] = await db
    .select()
    .from(payoutMethods)
    .where(
      and(eq(payoutMethods.id, methodId), eq(payoutMethods.userId, user.id)),
    )
    .limit(1);

  if (!row) throw new Error("Payout method not found");

  const { verified, detail } = await verifyPayoutMethod(rowToMethod(row));
  const now = new Date().toISOString();

  await db
    .update(payoutMethods)
    .set({
      verifiedAt: verified ? now : null,
      lastError: verified ? null : detail,
      updatedAt: now,
    })
    .where(eq(payoutMethods.id, methodId));

  revalidatePath("/profile/payouts");
}

/**
 * Remove a payout method. If it was the default and other verified
 * methods remain, promote the oldest so the contributor doesn't
 * silently become unpayable.
 */
export async function removePayoutMethod(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to remove a payout method");

  const methodId = String(formData.get("methodId") ?? "");
  const [row] = await db
    .select()
    .from(payoutMethods)
    .where(
      and(eq(payoutMethods.id, methodId), eq(payoutMethods.userId, user.id)),
    )
    .limit(1);

  if (!row) throw new Error("Payout method not found");

  await db.transaction(async (tx) => {
    await tx.delete(payoutMethods).where(eq(payoutMethods.id, methodId));

    if (row.isDefault) {
      const remaining = await tx
        .select()
        .from(payoutMethods)
        .where(eq(payoutMethods.userId, user.id));
      const promotable = remaining
        .filter((m) => m.verifiedAt !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (promotable) {
        await tx
          .update(payoutMethods)
          .set({ isDefault: true, updatedAt: new Date().toISOString() })
          .where(eq(payoutMethods.id, promotable.id));
      }
    }
  });

  logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "payout_method.removed",
    resourceKind: "payout_method",
    resourceId: methodId,
    before: { rail: row.rail },
    after: null,
  });

  revalidatePath("/profile/payouts");
}

/**
 * Admin: confirm an assisted-rail payout actually went out.
 *
 * Zelle and check payouts sit in `awaiting_manual` until a human sends
 * them from the cooperative's bank and records the reference here.
 * This is the only path that moves such a split to `sent`.
 *
 * REPLACE WITH: once this lands alongside the settlement engine, also
 * update the revenue_splits row (payout_status, payout_sent_at) in the
 * same transaction. Kept separate for now so the hub can ship without
 * touching settlement.
 */
export async function confirmManualPayout(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const splitId = String(formData.get("splitId") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();

  if (!splitId) throw new Error("Missing split id");
  if (!reference) {
    throw new Error(
      "Record the bank confirmation or check number so the payout is auditable.",
    );
  }

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "payout.manual_confirmed",
    resourceKind: "revenue_split",
    resourceId: splitId,
    before: null,
    after: { reference },
    reason: `Assisted-rail payout confirmed sent by ${admin.firstName ?? admin.id}`,
  });

  revalidatePath("/admin/payments");
}
