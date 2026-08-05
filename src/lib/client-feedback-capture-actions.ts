/**
 * Admin-capture flow for client feedback taken during a CX call.
 *
 * Preferred path is always client self-submission via the magic-link
 * questionnaire at /contracts/[id]/feedback. This module is for the
 * fallback: admin captures the client's verbally-stated rating live
 * during a review call. Structural evidence required — cannot
 * capture without a linked meeting_minute row (call recording +
 * summary).
 *
 * Provenance markers on the customer_feedback row:
 *   - capturedByAdminUserId: the admin who captured
 *   - captureContext:        human-readable context ("Q3 review call")
 *   - meetingMinuteId:       the call record evidence
 *   - clientConfirmationStatus: pending → confirmed | disputed
 *   - clientConfirmationToken: magic-link the client uses to
 *                              confirm or dispute the captured value
 *
 * Confirmation loop: after capture, an auto-magic-link fires to the
 * client's email. Client clicks to confirm the captured rating OR
 * dispute it. Disputes flip the composite math to exclude that
 * rating until resolved. MVP fires an audit-log entry as the
 * dispatch signal; production wires a real email through Postmark.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_CUSTOMER_FEEDBACK } from "@/lib/mock-data/customer-feedback";
import { MOCK_MEETING_MINUTES } from "@/lib/mock-data/meeting-minutes";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { CustomerFeedback } from "@/lib/types";

function nextFeedbackId(): string {
  return `cf_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function nextConfirmationToken(): string {
  return `cfconf_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Admin captures a client's verbally-stated rating during a CX
 * review call. Meeting-minute link REQUIRED — the whole point of
 * this flow is that structural evidence backs the capture.
 */
export async function captureClientFeedbackDuringCall(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const meetingMinuteId = String(
    formData.get("meetingMinuteId") ?? "",
  ).trim();
  const captureContext = String(formData.get("captureContext") ?? "").trim();
  const overallStarsRaw = String(formData.get("overallStars") ?? "").trim();
  const proseRaw = String(formData.get("prose") ?? "").trim();
  const wouldHireAgainRaw = String(
    formData.get("wouldHireAgain") ?? "",
  ).trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const clientEmail = String(formData.get("clientEmail") ?? "").trim();

  if (!projectId) throw new Error("Project id required.");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  if (!meetingMinuteId) {
    throw new Error(
      "Meeting-minute link required. Admin-capture cannot proceed without a linked call record — that's the structural evidence gate. Log the call on /calendar first, then reference the minute id here.",
    );
  }
  const minute = MOCK_MEETING_MINUTES.find((m) => m.id === meetingMinuteId);
  if (!minute) {
    throw new Error(
      `Meeting minute ${meetingMinuteId} not found. Verify the id from /calendar.`,
    );
  }

  if (!captureContext) {
    throw new Error(
      "Capture context required — e.g. \"Q3 review call 2026-08-04\".",
    );
  }
  const overallStars = Number(overallStarsRaw);
  if (!Number.isFinite(overallStars) || overallStars < 1 || overallStars > 5) {
    throw new Error("Overall rating must be 1–5.");
  }
  const wouldHireAgain = wouldHireAgainRaw === "yes";
  if (!clientName) throw new Error("Client name required.");
  if (!clientEmail) {
    throw new Error(
      "Client email required — it's where the confirmation magic-link fires.",
    );
  }

  // Refuse duplicate capture — one row per (project + admin-captured
  // context). Client can still self-submit later; that gets its own
  // row with capturedByAdminUserId = null.
  const already = MOCK_CUSTOMER_FEEDBACK.find(
    (f) =>
      f.contextKind === "contract" &&
      f.contextId === projectId &&
      f.capturedByAdminUserId !== null,
  );
  if (already) {
    throw new Error(
      "Admin-capture already exists for this project. Client can still self-submit via the magic-link; that will create a separate row.",
    );
  }

  const now = new Date().toISOString();
  const confirmationToken = nextConfirmationToken();
  const row: CustomerFeedback = {
    id: nextFeedbackId(),
    contextKind: "contract",
    contextId: projectId,
    customerName: clientName,
    customerEmail: clientEmail,
    overallStars,
    // Sub-dimensions default to the overall when captured live — admin
    // can't practically hold the client to 3 separate sub-scores in a
    // real conversation. Client-self-submit path captures them
    // separately; admin-capture treats them as coarser.
    metExpectations: overallStars,
    communication: overallStars,
    wouldHireAgain,
    prose: proseRaw || `[admin-captured summary] ${captureContext}`,
    contributorShoutout: null,
    // Default to internal_only for admin-captured — client hasn't
    // explicitly consented to external attribution during a verbal
    // call. Admin can bump this after client confirms via magic-link.
    attributionConsent: "internal_only",
    googleReviewOptIn: null,
    googleReviewFollowupStatus: null,
    googleReviewFollowupSentAt: null,
    publishedAt: null,
    publishedQuote: null,
    publishedForUserId: null,
    capturedByAdminUserId: admin.id,
    captureContext,
    meetingMinuteId,
    clientConfirmationStatus: "pending",
    clientConfirmationToken: confirmationToken,
    clientConfirmedAt: null,
    createdAt: now,
  };
  MOCK_CUSTOMER_FEEDBACK.push(row);

  // Audit — captures the provenance shape explicitly so the
  // pattern-surfacing task (#266) can flag admins with an unusual
  // capture-to-self-submit ratio.
  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.created", // reuse until customer_feedback.captured verb added
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: null,
    after: {
      kind: "customer_feedback_captured_by_admin",
      projectId,
      overallStars,
      meetingMinuteId,
      captureContext,
      confirmationToken,
    },
    reason: `Admin captured client rating (${overallStars}/5) during CX call. Meeting minute: ${meetingMinuteId}. Confirmation magic-link fired to ${clientEmail}.`,
  });

  // Confirmation magic-link — MVP logs the intent; production
  // dispatches via Postmark. The token gates a client-facing view
  // at /feedback/confirm/[token] (not built yet — follow-on).
  // eslint-disable-next-line no-console
  console.log(
    `[admin-capture] Confirmation link stub: /feedback/confirm/${confirmationToken} → email to ${clientEmail}`,
  );

  revalidatePath(`/admin/reserve`);
  revalidatePath(`/admin/contracts/${projectId}/settle`);
}
