/**
 * Client-side confirmation loop for admin-captured feedback.
 *
 * When admin captures a client's rating during a CX call
 * (Tier 27d), a magic-link fires to the client's email with a
 * token. This module handles the client-side actions the token
 * unlocks: confirm the captured rating, OR dispute it. Auth-free
 * by design — the token IS the credential.
 *
 * State machine:
 *   pending → confirmed  (rating stays in composite math)
 *   pending → disputed   (composite math excludes the row until
 *                         admin resolves — either re-captures with
 *                         corrected rating, or client submits
 *                         fresh via the /contracts/[id]/feedback
 *                         self-submission path)
 *
 * Both actions are idempotent-ish: refuse to double-confirm or
 * double-dispute the same row.
 */
"use server";

import { revalidatePath } from "next/cache";
import { MOCK_CUSTOMER_FEEDBACK } from "@/lib/mock-data/customer-feedback";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

/**
 * Client confirms the captured rating is accurate. Row status flips
 * to "confirmed"; composite math continues to include the rating.
 */
export async function confirmClientFeedback(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) throw new Error("Confirmation token is required.");

  const row = MOCK_CUSTOMER_FEEDBACK.find(
    (f) => f.clientConfirmationToken === token,
  );
  if (!row) throw new Error("Token not found or expired.");
  if (row.clientConfirmationStatus === "confirmed") {
    throw new Error("Already confirmed.");
  }
  if (row.clientConfirmationStatus === "disputed") {
    throw new Error(
      "Already marked as disputed. If you want to confirm now, contact your Future Modern account owner.",
    );
  }

  row.clientConfirmationStatus = "confirmed";
  row.clientConfirmedAt = new Date().toISOString();

  await logAuditEvent({
    actorUserId: null,
    actorRoleSnapshot: snapshotActorRole(null),
    action: "quote.approved",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: { clientConfirmationStatus: "pending" },
    after: {
      clientConfirmationStatus: "confirmed",
      clientConfirmedAt: row.clientConfirmedAt,
    },
    reason: `Client confirmed admin-captured feedback via magic-link (${row.customerEmail}).`,
  });

  revalidatePath(`/feedback/confirm/${token}`);
  if (row.capturedByAdminUserId) {
    revalidatePath(`/admin/reserve`);
  }
}

/**
 * Client disputes the captured rating. Row status flips to
 * "disputed"; triangulation excludes it from the composite math
 * until admin resolves. Admin sees the dispute on /admin/reserve
 * and takes action: re-capture with the correct rating (if a mistake
 * was made), or send the self-submission magic-link so the client
 * can enter it themselves.
 *
 * Optional prose captures WHY the client disputed — feeds the
 * client-dissatisfaction pattern surface as a real signal (a
 * dispute is stronger evidence than a low rating alone).
 */
export async function disputeClientFeedback(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const disputeReason = String(formData.get("disputeReason") ?? "").trim();
  if (!token) throw new Error("Confirmation token is required.");

  const row = MOCK_CUSTOMER_FEEDBACK.find(
    (f) => f.clientConfirmationToken === token,
  );
  if (!row) throw new Error("Token not found or expired.");
  if (row.clientConfirmationStatus === "disputed") {
    throw new Error("Already marked as disputed.");
  }
  if (row.clientConfirmationStatus === "confirmed") {
    throw new Error(
      "Already confirmed. If you need to change your rating, contact your Future Modern account owner.",
    );
  }

  row.clientConfirmationStatus = "disputed";
  row.clientConfirmedAt = new Date().toISOString();
  if (disputeReason) {
    row.prose = `${row.prose}\n\n[Client dispute reason]: ${disputeReason}`;
  }

  await logAuditEvent({
    actorUserId: null,
    actorRoleSnapshot: snapshotActorRole(null),
    action: "quote.declined",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: { clientConfirmationStatus: "pending" },
    after: {
      clientConfirmationStatus: "disputed",
      clientConfirmedAt: row.clientConfirmedAt,
    },
    reason: disputeReason
      ? `Client disputed admin-captured feedback: ${disputeReason}`
      : `Client disputed admin-captured feedback (no reason given).`,
  });

  revalidatePath(`/feedback/confirm/${token}`);
  if (row.capturedByAdminUserId) {
    revalidatePath(`/admin/reserve`);
  }
}
