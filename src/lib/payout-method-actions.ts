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
import { payoutMethods, revenueSplits } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import {
  RAIL_SPECS,
  externalRefForRail,
  validateRailFields,
  verifyPayoutMethod,
} from "@/lib/payments";
import type { PayoutMethod, PayoutRail } from "@/lib/payments";
import { validateLandingFiles } from "@/lib/landing-inbound-validation";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

/** Returned rather than thrown: Next strips action errors in prod. */
export interface ManualPayoutResult {
  ok: boolean;
  message: string;
}

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

  await logAuditEvent({
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

  await logAuditEvent({
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

  await logAuditEvent({
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
 * Admin: confirm a record-mode payout actually went out.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT NOW WRITES THE SPLIT (2026-11-03)
 *
 * This used to log an audit entry and nothing else. Its own docblock
 * said so: "REPLACE WITH: once this lands alongside the settlement
 * engine, also update the revenue_splits row (payout_status,
 * payout_sent_at)". The settlement engine landed and nobody came back,
 * so confirming a payout changed nothing. The audit log said confirmed
 * while the data still said failed, and lifetime paid stayed at zero
 * for money that had actually left the account.
 *
 * WHY IT TAKES A DATE
 *
 * Found has no API, so the money moves before anyone opens the app —
 * routinely days before. Stamping now() would record the moment
 * somebody got round to the paperwork, not the moment the recipient
 * was paid. Retroactive is the normal case for a record method, not an
 * exception.
 *
 * WHY IT TAKES A DOCUMENT
 *
 * Evidence in proportion to ignorance. The app did not witness this
 * payment, so a reference string is a claim and the payout record is
 * evidence. Mirrors the invoice source document in 0043: inbound
 * attaches the invoice we did not issue, outbound the payout we did
 * not send.
 * ─────────────────────────────────────────────────────────────
 */
export async function confirmManualPayout(
  formData: FormData,
): Promise<ManualPayoutResult> {
  const admin = await requireAdmin();

  const splitId = String(formData.get("splitId") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const sentOn = String(formData.get("sentOn") ?? "").trim();
  const file = formData.get("payoutDocument");

  if (!splitId) return { ok: false, message: "Missing split id." };
  if (!reference) {
    return {
      ok: false,
      message:
        "Record the bank confirmation or check number so the payout is auditable.",
    };
  }
  if (!sentOn) {
    return {
      ok: false,
      message:
        "Enter the date the money actually went out, not today. Found payouts are recorded after the fact.",
    };
  }

  const sentAt = new Date(`${sentOn}T12:00:00Z`);
  if (Number.isNaN(sentAt.getTime())) {
    return { ok: false, message: "That date is not valid." };
  }
  if (sentAt.getTime() > Date.now() + 86_400_000) {
    return { ok: false, message: "That date is in the future." };
  }

  const [split] = await db
    .select({ id: revenueSplits.id, status: revenueSplits.payoutStatus })
    .from(revenueSplits)
    .where(eq(revenueSplits.id, splitId))
    .limit(1);
  if (!split) return { ok: false, message: "That payout row does not exist." };

  // Same validator the application and invoice forms use: PDF only,
  // checked against the %PDF- magic bytes rather than the MIME type a
  // browser claimed.
  let document: { name: string; size: number; base64: string } | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      const [validated] = await validateLandingFiles([file]);
      document = validated
        ? { name: validated.name, size: validated.size, base64: validated.base64 }
        : null;
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error && /PDF/i.test(err.message)
            ? "The payout record has to be a PDF."
            : "That file is too large. Keep it under 12MB.",
      };
    }
  }

  await db
    .update(revenueSplits)
    .set({
      payoutStatus: "sent",
      payoutSentAt: sentAt.toISOString(),
      payoutReference: reference,
      ...(document
        ? {
            payoutDocumentName: document.name,
            payoutDocumentSize: document.size,
            payoutDocumentBase64: document.base64,
          }
        : {}),
    })
    .where(eq(revenueSplits.id, splitId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "payout.manual_confirmed",
    resourceKind: "revenue_split",
    resourceId: splitId,
    before: { payoutStatus: split.status },
    // The reference and the date are the record of what was done. The
    // document itself is not repeated here: the audit log is read by
    // more people than the payout row is.
    after: {
      payoutStatus: "sent",
      reference,
      payoutSentAt: sentAt.toISOString(),
      document: document?.name ?? null,
    },
    reason: `Record-mode payout confirmed sent by ${admin.firstName ?? admin.id}`,
  });

  revalidatePath("/admin/payments");
  revalidatePath("/profile/payouts");

  return { ok: true, message: `Recorded as sent on ${sentOn}.` };
}
