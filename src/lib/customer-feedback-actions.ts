/**
 * Customer feedback server actions (Phase 2.7 sandbox).
 *
 * Three actions:
 *   - submitCustomerFeedbackByLink: external client filled out the
 *     magic-link contract questionnaire (no auth gate — token-based
 *     in production, name+email gate in sandbox).
 *   - submitBuyerFeedback: signed-in buyer filled out the order
 *     questionnaire from /orders/[id] (auth gate).
 *   - publishTestimonial: admin pulls a quote from a feedback row and
 *     promotes it to a single contributor / seller's profile. Idempotent
 *     — re-publish overwrites the previous quote.
 *
 * All three fan out notifications:
 *   - submit → notify every admin (`customer_feedback_received`)
 *   - publish → notify the contributor (`testimonial_published`)
 *
 * REPLACE WITH: `customer_feedback` Drizzle inserts. Magic-link tokens
 * issued by the same service that powers /contracts/[id]/proposal —
 * keep the customer surface auth-free.
 */
"use server";

import { notify, notifyMany } from "@/lib/writers/notifications";
import { getAllUsers } from "@/lib/readers/users";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customerFeedback as customerFeedbackTable } from "@/db/schema";
import { getProjectById } from "@/lib/readers/projects";
import { getUserById } from "@/lib/readers/users";
import { customerFeedbackReader, orderReader } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type {
  AttributionConsent,
  CustomerFeedback,
  CustomerFeedbackContextKind,
  GoogleReviewOptIn,
  Notification,
} from "@/lib/types";

async function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): Promise<void> {
  // Writer swap 2026-08-28: delegates to the shared Postgres writer.
  // Was an in-memory push, so these notifications never survived a
  // deploy and the bell icon was effectively decorative.
  await notify(partial);
}

/**
 * Has this contract or order already been reviewed?
 *
 * Scoped in the query. This backs the "already submitted" guard on a
 * public magic-link route, so it must not read every piece of customer
 * feedback the cooperative holds to answer a question about one
 * engagement.
 */
async function hasFeedbackForContext(contextId: string): Promise<boolean> {
  const rows = await customerFeedbackReader.where(
    eq(customerFeedbackTable.contextId, contextId),
  );
  return rows.length > 0;
}

/** Persist one feedback row. */
async function insertFeedback(row: CustomerFeedback): Promise<void> {
  await db.insert(customerFeedbackTable).values({
    id: row.id,
    contextKind: row.contextKind,
    contextId: row.contextId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    overallStars: row.overallStars,
    metExpectations: row.metExpectations,
    communication: row.communication,
    wouldHireAgain: row.wouldHireAgain,
    prose: row.prose,
    contributorShoutout: row.contributorShoutout,
    attributionConsent: row.attributionConsent,
    googleReviewOptIn: row.googleReviewOptIn,
    googleReviewFollowupStatus: row.googleReviewFollowupStatus,
    googleReviewFollowupSentAt: row.googleReviewFollowupSentAt,
    publishedAt: row.publishedAt,
    publishedQuote: row.publishedQuote,
    publishedForUserId: row.publishedForUserId,
    capturedByAdminUserId: row.capturedByAdminUserId,
    captureContext: row.captureContext,
    meetingMinuteId: row.meetingMinuteId,
    clientConfirmationStatus: row.clientConfirmationStatus,
    clientConfirmationToken: row.clientConfirmationToken,
    clientConfirmedAt: row.clientConfirmedAt,
    createdAt: row.createdAt,
  });
}

async function fanOutToAdmins(
  title: string,
  body: string,
  href: string,
): Promise<void> {
  const { users } = await getAllUsers();
  await notifyMany(
    users.filter((u) => u.isAdmin).map((u) => u.id),
    { kind: "customer_feedback_received", title, body, href },
  );
}

async function fanOutReviewOptIn(
  customerName: string,
  contextLabel: string,
  href: string,
): Promise<void> {
  const { users } = await getAllUsers();
  await notifyMany(
    users.filter((u) => u.isAdmin).map((u) => u.id),
    {
      kind: "customer_review_optin",
      title: `${customerName} opted in to a Google Review`,
      body: `${customerName} (${contextLabel}) said yes to leaving a Google Review. Verify the prose, then send the follow-up email from the testimonials queue.`,
      href,
    },
  );
}

function clampStar(raw: FormDataEntryValue | null, field: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error(`${field} must be 1–5`);
  }
  return Math.round(n);
}

const ATTRIBUTION_CONSENT_VALUES: ReadonlyArray<AttributionConsent> = [
  "name_and_org",
  "org_only",
  "anonymized",
  "internal_only",
];

const GOOGLE_REVIEW_OPTIN_VALUES: ReadonlyArray<GoogleReviewOptIn> = [
  "yes_send_link",
  "ask_me_later",
  "no",
];

function parseEnum<T extends string>(
  raw: FormDataEntryValue | null,
  allowed: ReadonlyArray<T>,
  field: string,
): T {
  const v = String(raw ?? "");
  if (!(allowed as ReadonlyArray<string>).includes(v)) {
    throw new Error(`${field} is required`);
  }
  return v as T;
}

function parseSubmissionFields(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  if (customerName.length === 0) throw new Error("Name is required");
  if (!customerEmail.includes("@")) throw new Error("Email looks invalid");

  const overallStars = clampStar(formData.get("overallStars"), "Overall stars");
  const metExpectations = clampStar(
    formData.get("metExpectations"),
    "Met expectations",
  );
  const communication = clampStar(
    formData.get("communication"),
    "Communication",
  );
  const wouldHireAgain =
    String(formData.get("wouldHireAgain") ?? "").toLowerCase() === "yes";
  const prose = String(formData.get("prose") ?? "").trim();
  if (prose.length < 20) {
    throw new Error("A little prose helps — at least 20 characters");
  }

  const rawShoutout = String(formData.get("contributorShoutout") ?? "").trim();
  const contributorShoutout = rawShoutout.length > 0 ? rawShoutout : null;

  const attributionConsent = parseEnum<AttributionConsent>(
    formData.get("attributionConsent"),
    ATTRIBUTION_CONSENT_VALUES,
    "Attribution consent",
  );

  const googleReviewOptIn = parseEnum<GoogleReviewOptIn>(
    formData.get("googleReviewOptIn"),
    GOOGLE_REVIEW_OPTIN_VALUES,
    "Google Review opt-in",
  );

  return {
    customerName,
    customerEmail,
    overallStars,
    metExpectations,
    communication,
    wouldHireAgain,
    prose,
    contributorShoutout,
    attributionConsent,
    googleReviewOptIn,
  };
}

/**
 * Magic-link path. Customer hits /contracts/[id]/feedback?token=…;
 * the token-to-context check happens at the route level. Here we only
 * trust `contextId` from form payload because the route already
 * authenticated the link.
 */
export async function submitCustomerFeedbackByLink(formData: FormData) {
  const contextId = String(formData.get("contextId") ?? "");
  const project = await getProjectById(contextId);
  if (!project) throw new Error("Engagement not found");
  if (project.kind !== "contract") {
    throw new Error("This rail is for external client contracts only");
  }
  if (project.status !== "completed") {
    throw new Error("Feedback opens once the contract is marked completed");
  }
  if (await hasFeedbackForContext(contextId)) {
    throw new Error("Feedback for this engagement was already submitted");
  }

  const parsed = parseSubmissionFields(formData);
  const optedInToReview = parsed.googleReviewOptIn === "yes_send_link";
  const row: CustomerFeedback = {
    id: `cf_${randomUUID()}`,
    contextKind: "contract" as CustomerFeedbackContextKind,
    contextId,
    googleReviewFollowupStatus: optedInToReview ? "pending_review" : null,
    googleReviewFollowupSentAt: null,
    publishedAt: null,
    publishedQuote: null,
    publishedForUserId: null,
    capturedByAdminUserId: null,
    captureContext: null,
    meetingMinuteId: null,
    clientConfirmationStatus: null,
    clientConfirmationToken: null,
    clientConfirmedAt: null,
    createdAt: new Date().toISOString(),
    ...parsed,
  };
  await insertFeedback(row);

  await fanOutToAdmins(
    `Customer feedback on ${project.title}`,
    `${parsed.customerName} left a ${parsed.overallStars}★ review. Open the queue to triage and decide whether to publish a quote.`,
    "/admin/testimonials",
  );

  if (optedInToReview) {
    await fanOutReviewOptIn(
      parsed.customerName,
      project.title,
      "/admin/testimonials",
    );
  }

  revalidatePath(`/admin/feedback`);
  revalidatePath(`/admin/testimonials`);
  revalidatePath(`/contracts/${contextId}`);
}

/**
 * Buyer path. Signed-in buyer on `/orders/[id]` after delivery. Auth
 * gates the action; we copy name + email off the user record.
 */
export async function submitBuyerFeedback(formData: FormData) {
  const buyer = await getCurrentUser();
  if (!buyer) throw new Error("Sign in required");

  const orderId = String(formData.get("orderId") ?? "");
  const order = await orderReader.byId(orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId !== buyer.id) {
    throw new Error("You can only review orders you placed");
  }
  if (order.status !== "delivered") {
    throw new Error("Feedback opens after delivery");
  }
  if (await hasFeedbackForContext(orderId)) {
    throw new Error("You already left feedback for this order");
  }

  const overallStars = clampStar(formData.get("overallStars"), "Overall stars");
  const metExpectations = clampStar(
    formData.get("metExpectations"),
    "Met expectations",
  );
  const communication = clampStar(
    formData.get("communication"),
    "Communication",
  );
  const wouldHireAgain =
    String(formData.get("wouldHireAgain") ?? "").toLowerCase() === "yes";
  const prose = String(formData.get("prose") ?? "").trim();
  if (prose.length < 20) {
    throw new Error("A little prose helps — at least 20 characters");
  }

  const rawShoutout = String(formData.get("contributorShoutout") ?? "").trim();
  const contributorShoutout = rawShoutout.length > 0 ? rawShoutout : null;
  const attributionConsent = parseEnum<AttributionConsent>(
    formData.get("attributionConsent"),
    ATTRIBUTION_CONSENT_VALUES,
    "Attribution consent",
  );
  const googleReviewOptIn = parseEnum<GoogleReviewOptIn>(
    formData.get("googleReviewOptIn"),
    GOOGLE_REVIEW_OPTIN_VALUES,
    "Google Review opt-in",
  );
  const optedInToReview = googleReviewOptIn === "yes_send_link";

  const row: CustomerFeedback = {
    id: `cf_${randomUUID()}`,
    contextKind: "marketplace_order" as CustomerFeedbackContextKind,
    contextId: orderId,
    customerName: buyer.firstName ?? buyer.email,
    customerEmail: buyer.email,
    overallStars,
    metExpectations,
    communication,
    wouldHireAgain,
    prose,
    contributorShoutout,
    attributionConsent,
    googleReviewOptIn,
    googleReviewFollowupStatus: optedInToReview ? "pending_review" : null,
    googleReviewFollowupSentAt: null,
    publishedAt: null,
    publishedQuote: null,
    publishedForUserId: null,
    capturedByAdminUserId: null,
    captureContext: null,
    meetingMinuteId: null,
    clientConfirmationStatus: null,
    clientConfirmationToken: null,
    clientConfirmedAt: null,
    createdAt: new Date().toISOString(),
  };
  await insertFeedback(row);

  await fanOutToAdmins(
    `Buyer feedback on ${order.number}`,
    `${row.customerName} left a ${overallStars}★ review on the marketplace order. Open the queue to triage.`,
    "/admin/testimonials",
  );

  if (optedInToReview) {
    await fanOutReviewOptIn(row.customerName, `Order ${order.number}`, "/admin/testimonials");
  }

  revalidatePath(`/admin/feedback`);
  revalidatePath(`/admin/testimonials`);
  revalidatePath(`/orders/${orderId}`);
}

/**
 * Admin gate. Pulls a single quote out of a feedback row, attaches it
 * to a contributor / seller, and flips publishedAt. Re-publish
 * overwrites previous quote (so admin can refine after PII feedback).
 *
 * Enforces attributionConsent: rows missing the field OR set to
 * `internal_only` cannot be published. Default-deny.
 */
export async function publishTestimonial(formData: FormData) {
  const admin = await requireAdmin();
  const feedbackId = String(formData.get("feedbackId") ?? "");
  const publishedQuote = String(formData.get("publishedQuote") ?? "").trim();
  const publishedForUserId = String(
    formData.get("publishedForUserId") ?? "",
  );

  const row = await customerFeedbackReader.byId(feedbackId);
  if (!row) throw new Error("Feedback row not found");
  if (publishedQuote.length < 20) {
    throw new Error("Quote must be at least 20 characters");
  }
  if (publishedQuote.length > row.prose.length) {
    throw new Error("Quote cannot be longer than the original prose");
  }
  if (
    row.attributionConsent === null ||
    row.attributionConsent === "internal_only"
  ) {
    throw new Error(
      "Customer did not consent to external attribution — testimonial cannot be published.",
    );
  }
  const target = await getUserById(publishedForUserId);
  if (!target) throw new Error("Target contributor not found");

  const now = new Date().toISOString();
  const beforePublishedAt = row.publishedAt;
  // Guarded on still-unpublished so two admins promoting the same
  // quote can't overwrite each other's chosen excerpt.
  await db
    .update(customerFeedbackTable)
    .set({
      publishedAt: now,
      publishedQuote,
      publishedForUserId,
    })
    .where(eq(customerFeedbackTable.id, feedbackId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "testimonial.published",
    resourceKind: "user",
    resourceId: target.id,
    before: { publishedAt: beforePublishedAt },
    after: {
      publishedAt: now,
      feedbackId,
      quoteLength: publishedQuote.length,
    },
  });

  await pushNotification({
    userId: publishedForUserId,
    kind: "testimonial_published",
    title: `Testimonial published to your profile`,
    body: `An admin promoted a customer quote to your public-to-members profile. Open your profile to preview it.`,
    href: `/u/${target.handle}`,
  });

  revalidatePath(`/admin/feedback`);
  revalidatePath(`/u/${target.handle}`);
}

/**
 * Admin retract. Flips a published testimonial back to private without
 * deleting the underlying feedback row.
 */
export async function unpublishTestimonial(formData: FormData) {
  const admin = await requireAdmin();
  const feedbackId = String(formData.get("feedbackId") ?? "");
  const row = await customerFeedbackReader.byId(feedbackId);
  if (!row) throw new Error("Feedback row not found");
  const formerUserId = row.publishedForUserId;
  const formerHandle = formerUserId
    ? (await getUserById(formerUserId))?.handle
    : null;
  const beforePublishedAt = row.publishedAt;
  // Retract clears the published fields; the underlying feedback row
  // stays, so the customer's original words are never destroyed by an
  // admin changing their mind about showing them.
  await db
    .update(customerFeedbackTable)
    .set({
      publishedAt: null,
      publishedQuote: null,
      publishedForUserId: null,
    })
    .where(eq(customerFeedbackTable.id, feedbackId));

  if (formerUserId) {
    await logAuditEvent({
      actorUserId: admin.id,
      actorRoleSnapshot: snapshotActorRole(admin),
      action: "testimonial.unpublished",
      resourceKind: "user",
      resourceId: formerUserId,
      before: { publishedAt: beforePublishedAt, feedbackId },
      after: { publishedAt: null },
    });
  }

  revalidatePath(`/admin/feedback`);
  if (formerHandle) revalidatePath(`/u/${formerHandle}`);
}

/**
 * Admin marks the Google Review follow-up email as sent (or to-be-sent
 * by the production email infra). Sandbox flips status + records the
 * timestamp. Production swap: enqueue Postmark/Resend send with the
 * customer's email + the FM Google Reviews link + a starter line drawn
 * from the prose so the customer adapts rather than writes from scratch.
 */
export async function markGoogleReviewFollowupSent(formData: FormData) {
  await requireAdmin();
  const feedbackId = String(formData.get("feedbackId") ?? "");
  const row = await customerFeedbackReader.byId(feedbackId);
  if (!row) throw new Error("Feedback row not found");
  if (row.googleReviewOptIn !== "yes_send_link") {
    throw new Error(
      "Customer did not opt in to a Google Review follow-up.",
    );
  }
  if (row.googleReviewFollowupStatus === "sent") {
    throw new Error("Follow-up was already sent for this feedback row.");
  }
  // Guarded on not-already-sent, so a double-click can't record a
  // second send against the same customer.
  await db
    .update(customerFeedbackTable)
    .set({
      googleReviewFollowupStatus: "sent",
      googleReviewFollowupSentAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(customerFeedbackTable.id, feedbackId),
        eq(customerFeedbackTable.googleReviewFollowupStatus, "pending_review"),
      ),
    );
  revalidatePath(`/admin/testimonials`);
}

/**
 * Admin declines the Google Review follow-up — used when the prose
 * isn't quote-worthy after all, or the customer changed their mind
 * on a side channel. Does not flip publishedAt; the row stays as
 * private feedback.
 */
export async function declineGoogleReviewFollowup(formData: FormData) {
  await requireAdmin();
  const feedbackId = String(formData.get("feedbackId") ?? "");
  const row = await customerFeedbackReader.byId(feedbackId);
  if (!row) throw new Error("Feedback row not found");
  if (row.googleReviewOptIn !== "yes_send_link") {
    throw new Error(
      "Customer did not opt in to a Google Review follow-up.",
    );
  }
  await db
    .update(customerFeedbackTable)
    .set({ googleReviewFollowupStatus: "declined" })
    .where(eq(customerFeedbackTable.id, feedbackId));
  revalidatePath(`/admin/testimonials`);
}
