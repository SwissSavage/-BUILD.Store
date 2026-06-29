/**
 * Customer feedback mock data (Phase 2.7 sandbox).
 *
 * Two contexts:
 *   - "contract" — external client filled out a magic-link questionnaire
 *     after admin marked the contract `completed`.
 *   - "marketplace_order" — buyer filled out a questionnaire after
 *     order delivery.
 *
 * Posture (locked 2026-04-25): admin-gated by default. `publishedAt`
 * stays null until an admin promotes a single quote (after PII scrub)
 * to the contributor / seller's public-to-members profile.
 *
 * REPLACE WITH: `customer_feedback` Drizzle table.
 */
import type { CustomerFeedback } from "@/lib/types";

export const MOCK_CUSTOMER_FEEDBACK: CustomerFeedback[] = [
  // ── p_004 (URL Media editorial — Aliza solo, completed Feb)
  {
    id: "cf_001",
    contextKind: "contract",
    contextId: "p_004",
    customerName: "Devon Patel",
    customerEmail: "devon@url-media.example",
    overallStars: 5,
    metExpectations: 5,
    communication: 5,
    wouldHireAgain: true,
    prose:
      "Aliza turned what we expected to be a workmanlike artist series into the strongest editorial we've published this year. She found the throughline between the five subjects, defended the long-form structure when our marketing team pushed for shorter, and the photography pairing was inspired. Already plotting volume two.",
    contributorShoutout: "Aliza",
    attributionConsent: "name_and_org",
    googleReviewOptIn: "yes_send_link",
    googleReviewFollowupStatus: "sent",
    googleReviewFollowupSentAt: "2026-02-23T17:30:00Z",
    publishedAt: "2026-02-22T15:00:00Z",
    publishedQuote:
      "She found the throughline between the five subjects and defended the long-form structure when marketing pushed back. The strongest editorial we've published this year.",
    publishedForUserId: "u_aliza",
    createdAt: "2026-02-21T18:30:00Z",
  },

  // ── p_003 (DCG GTM — Rob + Michael, just completed). Pending admin.
  {
    id: "cf_002",
    contextKind: "contract",
    contextId: "p_003",
    customerName: "Marisa Quinn",
    customerEmail: "marisa.quinn@dcg.example",
    overallStars: 4,
    metExpectations: 5,
    communication: 4,
    wouldHireAgain: true,
    prose:
      "Memo + scorecard were exactly what we asked for; the regional benchmark appendix was a real bonus we hadn't scoped. One miss: midweek check-ins drifted toward async — fine for our team but I could see it not landing for a less-mature client. Solid work, would absolutely re-engage on the next vertical.",
    contributorShoutout: "Rob — the regional benchmark appendix was his idea",
    attributionConsent: "org_only",
    googleReviewOptIn: "ask_me_later",
    googleReviewFollowupStatus: null,
    googleReviewFollowupSentAt: null,
    publishedAt: null,
    publishedQuote: null,
    publishedForUserId: null,
    createdAt: "2026-04-22T16:15:00Z",
  },

  // ── ord_002 (Chibu bought Aliza's zine — delivered, buyer left a note)
  {
    id: "cf_003",
    contextKind: "marketplace_order",
    contextId: "ord_002",
    customerName: "Chibu",
    customerEmail: "chibu@example.com",
    overallStars: 5,
    metExpectations: 5,
    communication: 5,
    wouldHireAgain: true,
    prose:
      "Zine arrived faster than the estimate and packaged with care — even the insert card felt considered. This is the kind of object I want more cooperators making.",
    contributorShoutout: null,
    attributionConsent: "anonymized",
    googleReviewOptIn: "no",
    googleReviewFollowupStatus: null,
    googleReviewFollowupSentAt: null,
    publishedAt: null,
    publishedQuote: null,
    publishedForUserId: null,
    createdAt: "2026-04-23T15:00:00Z",
  },
];

/** All feedback for a given context (project or order). */
export function feedbackForContext(contextId: string): CustomerFeedback[] {
  return MOCK_CUSTOMER_FEEDBACK.filter((f) => f.contextId === contextId);
}

/** Pending (unpublished) feedback for the admin queue. Newest-first. */
export function pendingFeedback(): CustomerFeedback[] {
  return MOCK_CUSTOMER_FEEDBACK.filter((f) => f.publishedAt === null).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * Published testimonials attached to a contributor / seller. Renders
 * on `/u/[handle]` (members-only). Newest-first.
 */
export function testimonialsForUser(userId: string): CustomerFeedback[] {
  return MOCK_CUSTOMER_FEEDBACK.filter(
    (f) => f.publishedForUserId === userId && f.publishedAt !== null,
  ).sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
}

/**
 * Has this context already collected a customer feedback row? Used by
 * the buyer/order surface to render either the form or a thank-you.
 */
export function hasFeedbackForContext(contextId: string): boolean {
  return MOCK_CUSTOMER_FEEDBACK.some((f) => f.contextId === contextId);
}
