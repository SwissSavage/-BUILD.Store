/**
 * What actually goes out when a review round opens, or when somebody
 * is nudged.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THE COPY LIVES HERE (2026-11-25)
 *
 * Jamar: "I'd also like to see what goes out when we send the review
 * email link or nudge."
 *
 * It was written inline inside openReviewRound, which meant a preview
 * would have to be a second copy of the same words. Two copies drift,
 * and a preview that drifts is worse than no preview: it shows an
 * admin something reassuring and sends something else.
 *
 * So the sender and the preview call the same function. What you read
 * on the configure screen is the message, not a rendering of it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY MEMBERS AND CLIENTS GET DIFFERENT WORDS
 *
 * A member is being asked to rate people they worked with, and the
 * thing they most need to know is that it is anonymous to the person
 * rated — otherwise they write something polite and the instrument
 * measures nothing.
 *
 * A client is being asked how the work went. They do not need to hear
 * about peer slots, blended ratings or the Bonus Margin, and telling
 * them their stars move somebody's pay would be a thumb on the scale.
 *
 * Plain text on purpose. These land in a lot of mail clients and a
 * review request that renders as broken HTML gets deleted.
 * ─────────────────────────────────────────────────────────────
 */

export interface ReviewEmail {
  subject: string;
  text: string;
}

export type ReviewAudience = "member" | "client";

/**
 * The opening message: everyone is asked at the same moment, so this
 * is the one that goes to all recipients when the round opens.
 */
export function reviewInviteEmail(input: {
  audience: ReviewAudience;
  projectTitle: string;
  url: string;
  /** Who the message is to, when known. Clients get no name. */
  recipientName?: string | null;
}): ReviewEmail {
  const greeting = input.recipientName ? `${input.recipientName},\n\n` : "";

  if (input.audience === "client") {
    return {
      subject: `How did ${input.projectTitle} go?`,
      text:
        `${greeting}${input.projectTitle} is wrapped, and we would like to know how it went from your side.\n\n` +
        `It takes about two minutes:\n${input.url}\n\n` +
        `If something could have gone better, that is the most useful thing you can tell us. ` +
        `We would rather hear it now than not at all.\n\n` +
        `Thank you,\nFuture Modern`,
    };
  }

  return {
    subject: `Reviews are open for ${input.projectTitle}`,
    text:
      `${greeting}${input.projectTitle} is wrapped. Everyone who worked on it is being asked at the same time, ` +
      `so nobody is rated by a partial room.\n\n` +
      `${input.url}\n\n` +
      `The person you rate sees the score. They never see who gave it.\n\n` +
      `Where you score below the top, you will be asked what would have been better. ` +
      `If you cannot name it, the score should be higher.\n\n` +
      `Future Modern`,
  };
}

/**
 * The nudge: same link, shorter, for somebody who has not answered.
 *
 * Deliberately not guilt-inducing. A nudge that reads as a telling-off
 * gets a rushed five across the board, which is worse than silence
 * because it looks like data.
 */
export function reviewNudgeEmail(input: {
  audience: ReviewAudience;
  projectTitle: string;
  url: string;
  recipientName?: string | null;
}): ReviewEmail {
  const greeting = input.recipientName ? `${input.recipientName},\n\n` : "";

  if (input.audience === "client") {
    return {
      subject: `Still open: how did ${input.projectTitle} go?`,
      text:
        `${greeting}The questionnaire for ${input.projectTitle} is still open if you have a couple of minutes.\n\n` +
        `${input.url}\n\n` +
        `No reply is a fine answer too.\n\nFuture Modern`,
    };
  }

  return {
    subject: `Still open: reviews for ${input.projectTitle}`,
    text:
      `${greeting}Your reviews for ${input.projectTitle} are still open.\n\n` +
      `${input.url}\n\n` +
      `Scores reach the person rated. Who gave them does not.\n\nFuture Modern`,
  };
}
