/**
 * Domain readers — every surface reads live Postgres through here.
 *
 * ─────────────────────────────────────────────────────────────
 * NO MOCK FALLBACK, BY DESIGN (2026-08-28)
 *
 * The sandbox era is over. These readers query Postgres and nothing
 * else. If a table is empty, pages render empty — which is the honest
 * answer, and infinitely better than the previous behavior of quietly
 * substituting July seed fixtures for real member data.
 *
 * Pages that need to survive an unreachable database wrap calls in
 * `safely()` from ./factory and render an empty state.
 * ─────────────────────────────────────────────────────────────
 *
 * Domains here get a reader even when the workflow behind them isn't
 * exercised yet (EPK, canonization, vouchers). That's deliberate:
 * beta will exercise them, and having the read path already real
 * means the first person to try it sees their own data rather than
 * somebody's seed fixture.
 */
import { and, desc, eq, inArray, isNull, not } from "drizzle-orm";
import {
  agreements,
  artistEpks,
  buildVouchers,
  calendarMeetings,
  chatMessages,
  chatThreads,
  cohortSpotlights,
  communityMessages,
  customerFeedback,
  feedbackEntries,
  inboundSubmissions,
  invoices,
  jobApplications,
  meetingMinutes,
  memberCanonizations,
  mvpScores,
  orders,
  partnerReferrals,
  peerReviews,
  portfolioItems,
  projectMilestones,
  prospectiveContributions,
  quoteSheets,
  reservePoolLedger,
  revenueSplits,
  attributionEntries,
  tokenTransactions,
} from "@/db/schema";
import { makeReader } from "./factory";
import type {
  Agreement,
  ArtistEpk,
  AttributionEntry,
  BuildVoucher,
  ChatMessage,
  ChatThread,
  CohortSpotlight,
  CustomerFeedback,
  FeedbackEntry,
  InboundSubmission,
  Invoice,
  MeetingMinute,
  MemberCanonization,
  MvpScore,
  Order,
  PartnerReferral,
  PeerReview,
  PortfolioItem,
  ProjectMilestone,
  ProspectiveContribution,
  QuoteSheet,
  ReservePoolLedgerEntry,
  RevenueSplit,
  TokenTransaction,
} from "@/lib/types";

export { safely } from "./factory";

// ──────────────────────────────────────────────────────────────
//  Portfolio
// ──────────────────────────────────────────────────────────────

export const portfolioReader = makeReader<PortfolioItem>(portfolioItems, {
  orderBy: portfolioItems.createdAt,
  idColumn: portfolioItems.id,
});

/** One member's portfolio, including unpublished drafts. */
export function getPortfolioForUser(userId: string): Promise<PortfolioItem[]> {
  return portfolioReader.where(eq(portfolioItems.userId, userId));
}

/** Published work only — public profiles and the showcase. */
export function getPublishedPortfolio(): Promise<PortfolioItem[]> {
  return portfolioReader.where(not(isNull(portfolioItems.publishedAt)));
}

// ──────────────────────────────────────────────────────────────
//  Peer reviews + MVP scores
// ──────────────────────────────────────────────────────────────

export const peerReviewReader = makeReader<PeerReview>(peerReviews, {
  orderBy: peerReviews.createdAt,
  idColumn: peerReviews.id,
});

/** Reviews written about someone. Feeds their MVP aggregate. */
export function getReviewsOf(revieweeId: string): Promise<PeerReview[]> {
  return peerReviewReader.where(eq(peerReviews.revieweeId, revieweeId));
}

/** Reviews someone has written. Used to nag for outstanding ones. */
export function getReviewsBy(reviewerId: string): Promise<PeerReview[]> {
  return peerReviewReader.where(eq(peerReviews.reviewerId, reviewerId));
}

export const mvpScoreReader = makeReader<MvpScore>(mvpScores, {
  orderBy: mvpScores.ovr,
  idColumn: mvpScores.userId,
});

/** One member's current MVP score, or null if never computed. */
export function getMvpScore(userId: string): Promise<MvpScore | null> {
  return mvpScoreReader.one(eq(mvpScores.userId, userId));
}

// ──────────────────────────────────────────────────────────────
//  Milestones / project tracker
// ──────────────────────────────────────────────────────────────

export const milestoneReader = makeReader<ProjectMilestone>(projectMilestones, {
  orderBy: projectMilestones.sequence,
  direction: "asc",
  idColumn: projectMilestones.id,
});

/** Ordered milestones for the client-facing tracker. */
export function getMilestonesForProject(
  projectId: string,
): Promise<ProjectMilestone[]> {
  return milestoneReader.where(eq(projectMilestones.projectId, projectId));
}

/** Milestones a member owns across every project. */
export function getMilestonesForOwner(
  userId: string,
): Promise<ProjectMilestone[]> {
  return milestoneReader.where(eq(projectMilestones.ownerUserId, userId));
}

// ──────────────────────────────────────────────────────────────
//  EPK
// ──────────────────────────────────────────────────────────────

export const epkReader = makeReader<ArtistEpk>(artistEpks, {
  idColumn: artistEpks.userId,
});

export function getEpk(userId: string): Promise<ArtistEpk | null> {
  return epkReader.one(eq(artistEpks.userId, userId));
}

/** Published EPKs — what /u/[handle] flips to in EPK mode. */
export function getPublishedEpks(): Promise<ArtistEpk[]> {
  return epkReader.where(eq(artistEpks.status, "published"));
}

/** Submitted-but-unpublished EPKs — the admin curation queue. */
export function getPendingEpks(): Promise<ArtistEpk[]> {
  return epkReader.where(eq(artistEpks.status, "submitted"));
}

// ──────────────────────────────────────────────────────────────
//  Agreements
// ──────────────────────────────────────────────────────────────

export const agreementReader = makeReader<Agreement>(agreements, {
  orderBy: agreements.createdAt,
  idColumn: agreements.id,
});

export function getAgreementsForUser(userId: string): Promise<Agreement[]> {
  return agreementReader.where(eq(agreements.userId, userId));
}

// ──────────────────────────────────────────────────────────────
//  Direct messages / chat
// ──────────────────────────────────────────────────────────────

export const chatThreadReader = makeReader<ChatThread>(chatThreads, {
  orderBy: chatThreads.lastMessageAt,
  idColumn: chatThreads.id,
});

export const chatMessageReader = makeReader<ChatMessage>(chatMessages, {
  orderBy: chatMessages.createdAt,
  direction: "asc",
  idColumn: chatMessages.id,
});

export function getMessagesForThread(
  threadId: string,
): Promise<ChatMessage[]> {
  return chatMessageReader.where(eq(chatMessages.threadId, threadId));
}

type CommunityMessageRow = typeof communityMessages.$inferSelect;
export const communityMessageReader = makeReader<CommunityMessageRow>(
  communityMessages,
  { orderBy: communityMessages.createdAt, idColumn: communityMessages.id },
);

// ──────────────────────────────────────────────────────────────
//  Money: invoices, splits, attribution, orders, tokens, reserve
// ──────────────────────────────────────────────────────────────

export const invoiceReader = makeReader<Invoice>(invoices, {
  orderBy: invoices.createdAt,
  idColumn: invoices.id,
});

export const splitReader = makeReader<RevenueSplit>(revenueSplits, {
  orderBy: revenueSplits.decidedAt,
  idColumn: revenueSplits.id,
});

/** Splits owed to one member. Powers /profile/payouts. */
export function getSplitsForRecipient(
  userId: string,
): Promise<RevenueSplit[]> {
  return splitReader.where(eq(revenueSplits.recipientId, userId));
}

/** Splits still awaiting dispatch — the payments admin queue. */
export function getPendingSplits(): Promise<RevenueSplit[]> {
  return splitReader.where(
    inArray(revenueSplits.payoutStatus, ["pending", "queued"]),
  );
}

export const attributionReader = makeReader<AttributionEntry>(
  attributionEntries,
  { orderBy: attributionEntries.loggedAt, idColumn: attributionEntries.id },
);

export function getAttributionForUser(
  userId: string,
): Promise<AttributionEntry[]> {
  return attributionReader.where(eq(attributionEntries.userId, userId));
}

export const orderReader = makeReader<Order>(orders, {
  orderBy: orders.placedAt,
  idColumn: orders.id,
});

export const tokenReader = makeReader<TokenTransaction>(tokenTransactions, {
  orderBy: tokenTransactions.createdAt,
  idColumn: tokenTransactions.id,
});

export function getTokensForUser(userId: string): Promise<TokenTransaction[]> {
  return tokenReader.where(eq(tokenTransactions.userId, userId));
}

export const reserveReader = makeReader<ReservePoolLedgerEntry>(reservePoolLedger, {
  orderBy: reservePoolLedger.createdAt,
  idColumn: reservePoolLedger.id,
});

export const quoteSheetReader = makeReader<QuoteSheet>(quoteSheets, {
  orderBy: quoteSheets.createdAt,
  idColumn: quoteSheets.id,
});

export function getQuotesForUser(userId: string): Promise<QuoteSheet[]> {
  return quoteSheetReader.where(eq(quoteSheets.userId, userId));
}

// ──────────────────────────────────────────────────────────────
//  Recognition
// ──────────────────────────────────────────────────────────────

export const canonizationReader = makeReader<MemberCanonization>(
  memberCanonizations,
  { orderBy: memberCanonizations.frozenAt, idColumn: memberCanonizations.id },
);

export const spotlightReader = makeReader<CohortSpotlight>(cohortSpotlights, {
  orderBy: cohortSpotlights.publishedAt,
  idColumn: cohortSpotlights.id,
});

export const voucherReader = makeReader<BuildVoucher>(buildVouchers, {
  orderBy: buildVouchers.createdAt,
  idColumn: buildVouchers.id,
});

export function getVouchersForUser(userId: string): Promise<BuildVoucher[]> {
  return voucherReader.where(eq(buildVouchers.userId, userId));
}

// ──────────────────────────────────────────────────────────────
//  Feedback + inbound
// ──────────────────────────────────────────────────────────────

export const customerFeedbackReader = makeReader<CustomerFeedback>(
  customerFeedback,
  { orderBy: customerFeedback.createdAt, idColumn: customerFeedback.id },
);

/** Admin-promoted testimonials, for public surfaces. */
export function getPublishedTestimonials(): Promise<CustomerFeedback[]> {
  return customerFeedbackReader.where(
    not(isNull(customerFeedback.publishedAt)),
  );
}

export const feedbackReader = makeReader<FeedbackEntry>(feedbackEntries, {
  orderBy: feedbackEntries.createdAt,
  idColumn: feedbackEntries.id,
});

export const inboundReader = makeReader<InboundSubmission>(
  inboundSubmissions,
  { orderBy: inboundSubmissions.createdAt, idColumn: inboundSubmissions.id },
);

/** Untriaged inbound — the queue light on /admin. */
export function getOpenInbound(): Promise<InboundSubmission[]> {
  return inboundReader.where(eq(inboundSubmissions.status, "new"));
}

type JobApplicationRow = typeof jobApplications.$inferSelect;
export const jobApplicationReader = makeReader<JobApplicationRow>(
  jobApplications,
  { orderBy: jobApplications.createdAt, idColumn: jobApplications.id },
);

export const prospectiveContributionReader =
  makeReader<ProspectiveContribution>(prospectiveContributions, {
    orderBy: prospectiveContributions.createdAt,
    idColumn: prospectiveContributions.id,
  });

export const partnerReferralReader = makeReader<PartnerReferral>(
  partnerReferrals,
  { orderBy: partnerReferrals.createdAt, idColumn: partnerReferrals.id },
);

// ──────────────────────────────────────────────────────────────
//  Calendar + minutes
// ──────────────────────────────────────────────────────────────

export const meetingReader = makeReader<CalendarMeetingRow>(calendarMeetings, {
  orderBy: calendarMeetings.startsAt,
  idColumn: calendarMeetings.id,
});
type CalendarMeetingRow = typeof calendarMeetings.$inferSelect;

export const minutesReader = makeReader<MeetingMinute>(meetingMinutes, {
  orderBy: meetingMinutes.capturedAt,
  idColumn: meetingMinutes.id,
});

/** Meetings a member is on, upcoming first. */
export function getMeetingsForUser(
  userId: string,
): Promise<CalendarMeetingRow[]> {
  return meetingReader.where(eq(calendarMeetings.organizerId, userId));
}

/** Re-exported so callers can build their own predicates. */
export { and, desc, eq, inArray, isNull, not };
