/**
 * The review round for one engagement.
 *
 * Read by every surface that needs to know whether reviewing is
 * allowed, which is all of them: no round open means no review of any
 * kind is accepted. See drizzle/0059.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  engagementReviewRecipients,
  engagementReviewRounds,
} from "@/db/schema";

export type ReviewRound = typeof engagementReviewRounds.$inferSelect;

export async function getReviewRound(
  projectId: string,
): Promise<ReviewRound | null> {
  const [row] = await db
    .select()
    .from(engagementReviewRounds)
    .where(eq(engagementReviewRounds.projectId, projectId))
    .limit(1);
  return row ?? null;
}

export interface ReviewGateState {
  open: boolean;
  round: ReviewRound | null;
  /** Recipients who still do not hold the link. */
  waitingOn: (typeof engagementReviewRecipients.$inferSelect)[];
  reason:
    | "no_round"
    | "draft"
    | "awaiting_delivery"
    | "closed"
    | "open";
}

/**
 * Whether a review may be submitted right now.
 *
 * ONE PLACE, so a new review surface cannot forget to ask. Every
 * review action calls this and refuses on a false.
 *
 * Three ways to be shut, and they are not the same thing:
 *
 *   no_round / draft   nothing has been sent. "If I'm not configuring
 *                      a review to reach the customer and related
 *                      parties there shouldn't be any reviewing
 *                      happening at all."
 *   awaiting_delivery  the round is open but somebody does not hold
 *                      the link yet. "Everyone at the same time" is
 *                      only true if everyone actually has it —
 *                      otherwise the blend is computed from whoever
 *                      the mail server happened to reach.
 *   closed             the round is done and the blend is final.
 */
export async function reviewGateState(
  projectId: string,
): Promise<ReviewGateState> {
  const round = await getReviewRound(projectId);
  if (!round) {
    return { open: false, round: null, waitingOn: [], reason: "no_round" };
  }
  if (round.status === "draft") {
    return { open: false, round, waitingOn: [], reason: "draft" };
  }
  if (round.status === "closed") {
    return { open: false, round, waitingOn: [], reason: "closed" };
  }

  const recipients = await db
    .select()
    .from(engagementReviewRecipients)
    .where(eq(engagementReviewRecipients.roundId, round.id));
  const waitingOn = recipients.filter((r) => r.deliveryStatus !== "delivered");

  return {
    open: waitingOn.length === 0,
    round,
    waitingOn,
    reason: waitingOn.length === 0 ? "open" : "awaiting_delivery",
  };
}

/** Convenience for callers that only need the yes or no. */
export async function reviewsAreOpen(projectId: string): Promise<boolean> {
  return (await reviewGateState(projectId)).open;
}
