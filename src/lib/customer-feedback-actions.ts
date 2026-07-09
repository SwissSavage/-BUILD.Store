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

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import {
  MOCK_CUSTOMER_FEEDBACK,
  hasFeedbackForContext,
} from "@/lib/mock-data/customer-feedback";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import type {
  AttributionConsent,
  CustomerFeedback,
  CustomerFeedbackContextKind,
  GoogleReviewOptIn,
  Notification,
} from "@/lib/types";

function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): void {
  const id = `ntf_cf_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  MOCK_NOTIFICATIONS.push({
    ...partial,
    id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function fanOutToAdmins(title: string, body: string, href: string): void {
  for (const u of MOCK_USERS) {
    if (!u.isAdmin) continue;
    pushNotification({
      userId: u.id,
      kind: "customer_feedback_received",
      title,
      body,
      href,
    });
  }
}

function fanOutReviewOptIn(
  customerName: string,
  contextLabel: string,
  href: string,
): void {
  for (const u of MOCK_USERS) {
    if (!u.isAdmin) continue;
    pushNotification({
      userId: u.id,
      kind: "customer_review_optin",
      title: `${customerName} opted in to a Google Review`,
      body: `${customerName} (${contextLabel}) said yes to leaving a Google Review. Verify the prose, then send the follow-up email from the testimonials queue.`,
      href,
    });
  }
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
  const project = MOCK_PROJECTS.find((p) => p.id === contextId);
  if (!project) throw new Error("Engagement not found");
  if (project.kind !== "contract") {
    throw new Error("This rail is for external client contracts only");
  }
  if (project.status !== "completed") {
    throw new Error("Feedback opens once the contract is marked completed");
  }
  if (hasFeedbackForContext(contextId)) {
    throw new Error("Feedback for this engagement was already submitted");
  }

  const parsed = parseSubmissionFields(formData);
  const optedInToReview = parsed.googleReviewOptIn === "yes_send_link";
  const row: CustomerFeedback = {
    id: `cf_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    contextKind: "contract" as CustomerFeedbackContextKind,
    contextId,
    googleReviewFollowupStatus: optedInToReview ? "pending_review" : null,
    googleReviewFollowupSentAt: null,
    publishedAt: null,
    publishedQuote: null,
    publishedForUserId: null,
    createdAt: new Date().toISOString(),
    ...parsed,
  };
  MOCK_CUSTOMER_FEEDBACK.push(row);

  fanOutToAdmins(
    `Customer feedback on ${project.title}`,
    `${parsed.customerName} left a ${parsed.overallStars}★ review. Open the queue to triage and decide whether to publish a quote.`,
    "/admin/testimonials",
  );

  if (optedInToReview) {
    fanOutReviewOptIn(
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
  const order = MOCK_ORDERS.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found");
  if (order.buyerId !== buyer.id) {
    throw new Error("You can only review orders you placed");
  }
  if (order.status !== "delivered") {
    throw new Error("Feedback opens after delivery");
  }
  if (hasFeedbackForContext(orderId)) {
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
    id: `cf_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
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
    createdAt: new Date().toISOString(),
  };
  MOCK_CUSTOMER_FEEDBACK.push(row);

  fanOutToAdmins(
    `Buyer feedback on ${order.number}`,
    `${row.customerName} left a ${overallStars}★ review on the marketplace order. Open the queue to triage.`,
    "/admin/testimonials",
  );

  if (optedInToReview) {
    fanOutReviewOptIn(row.customerName, `Order ${order.number}`, "/admin/testimonials");
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

  const row = MOCK_CUSTOMER_FEEDBACK.find((f) => f.id === feedbackId);
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
  const target = MOCK_USERS.find((u) => u.id === publishedForUserId);
  if (!target) throw new Error("Target contributor not found");

  const now = new Date().toISOString();
  const beforePublishedAt = row.publishedAt;
  row.publishedAt = now;
  row.publishedQuote = publishedQuote;
  row.publishedForUserId = publishedForUserId;

  logAuditEvent({
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

  pushNotification({
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
  const row = MOCK_CUSTOMER_FEEDBACK.find((f) => f.id === feedbackId);
  if (!row) throw new Error("Feedback row not found");
  const formerUserId = row.publishedForUserId;
  const formerHandle = formerUserId
    ? MOCK_USERS.find((u) => u.id === formerUserId)?.handle
    : null;
  const beforePublishedAt = row.publishedAt;
  row.publishedAt = null;
  row.publishedQuote = null;
  row.publishedForUserId = null;

  if (formerUserId) {
    logAuditEvent({
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
  const row = MOCK_CUSTOMER_FEEDBACK.find((f) => f.id === feedbackId);
  if (!row) throw new Error("Feedback row not found");
  if (row.googleReviewOptIn !== "yes_send_link") {
    throw new Error(
      "Customer did not opt in to a Google Review follow-up.",
    );
  }
  if (row.googleReviewFollowupStatus === "sent") {
    throw new Error("Follow-up was already sent for this feedback row.");
  }
  row.googleReviewFollowupStatus = "sent";
  row.googleReviewFollowupSentAt = new Date().toISOString();
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
  const row = MOCK_CUSTOMER_FEEDBACK.find((f) => f.id === feedbackId);
  if (!row) throw new Error("Feedback row not found");
  if (row.googleReviewOptIn !== "yes_send_link") {
    throw new Error(
      "Customer did not opt in to a Google Review follow-up.",
    );
  }
  row.googleReviewFollowupStatus = "declined";
  revalidatePath(`/admin/testimonials`);
}
