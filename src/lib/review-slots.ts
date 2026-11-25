/**
 * Which slot a person's own rating counts in.
 *
 * ─────────────────────────────────────────────────────────────
 * TWO ASSIGNMENTS, NOT ONE (2026-11-25)
 *
 * Jamar: "question types should get one assignment, role types get
 * another."
 *
 * Two different facts about the same person on the same engagement,
 * and I had only built the first:
 *
 *   engagement_roles  what somebody is ASKED ABOUT. Holding
 *                     `payments` means others can be asked whether
 *                     they paid on time. Questions pointed AT them.
 *                     lib/engagement-roles.
 *
 *   review slot       what somebody's OWN rating counts AS. Whether
 *                     their answer lands in the peer slot or the PM
 *                     slot of the blend that sets the Bonus Margin.
 *                     This file.
 *
 * Rob on AWS makes it concrete. He is asked about scope clarity and
 * responsiveness because he held client_owner and delivery_oversight.
 * Separately, his rating of the design work counts as a PEER rating,
 * because he studied design and his read on the craft is worth
 * weighting. Neither fact implies the other.
 *
 * ─────────────────────────────────────────────────────────────
 * ASSIGNMENT IS THE EXCEPTION, NOT THE NORM
 *
 * Jamar: "this should only happen when there are fewer than 4 parties
 * on a project", and "or no one clearly in the peer category."
 *
 * It exists because a small engagement cannot fill its own slots. AWS
 * had three people: Ozy delivering, Rob and Jamar running it. With no
 * second contributor, Ozy's peer slot sits empty and renormalizes
 * away, so the blend falls to the client and the PM and nothing reads
 * the craft at all. Putting Rob in the peer slot is how a three-person
 * job gets a craft reading.
 *
 * On a bigger engagement the slots fill themselves and a manual
 * override stops being a necessity and starts being a lever on whose
 * opinion moves somebody's pay. So the control is not offered there.
 *
 * I also built a second branch for an engagement with several admins
 * and a single contributor, where the count passes but the subject is
 * still peerless. Jamar: "we will almost never have a situation where
 * there are four admins and one worker." Removed — a branch for a
 * case that does not occur is a branch nobody will ever check, and it
 * made the rule two things instead of one.
 *
 * NO DATABASE IMPORTS. Pure, so it crosses to a client component.
 * ─────────────────────────────────────────────────────────────
 */

export type ReviewSlot = "peer" | "pm";

export const REVIEW_SLOT_LABELS: Record<ReviewSlot, string> = {
  peer: "Peer",
  pm: "PM",
};

export const REVIEW_SLOT_DESCRIBES: Record<ReviewSlot, string> = {
  peer: "Their rating counts toward the craft reading, weighted 0.4.",
  pm: "Their rating counts as the run-of-the-engagement reading, weighted 0.2.",
};

/** Below this many parties, the slots cannot reliably fill themselves. */
export const SMALL_ENGAGEMENT_PARTIES = 4;

export interface SlotAvailability {
  available: boolean;
  reason: "small_engagement" | "slots_fill_themselves";
  explanation: string;
}

/**
 * Whether a slot may be assigned on this engagement, for this person.
 *
 * `subjectUserId` is the person being RATED. Peerlessness is a fact
 * about them, not about the engagement: on a mixed team one
 * contributor can be peerless while another has three peers.
 */
export function slotAssignment(input: {
  /** Everyone the split pays: contributors and admins together. */
  partyUserIds: string[];
}): SlotAvailability {
  const parties = new Set(input.partyUserIds).size;
  if (parties < SMALL_ENGAGEMENT_PARTIES) {
    return {
      available: true,
      reason: "small_engagement",
      explanation: `Fewer than ${SMALL_ENGAGEMENT_PARTIES} people on this engagement, so the slots cannot fill themselves.`,
    };
  }
  return {
    available: false,
    reason: "slots_fill_themselves",
    explanation: `${parties} people on this engagement, so peers are already here. Assigning one by hand would only change whose opinion carries weight.`,
  };
}

/**
 * Resolve every rating into its slot.
 *
 * Assignment wins where it exists. Otherwise the natural reading
 * applies: somebody who did delivery work is a peer, and the
 * engagement's admins are not peers — an admin's view of craft counts
 * only when somebody said it should.
 *
 * That default is deliberate rather than convenient. Counting every
 * admin as a peer would mean the people who ran the job also grade the
 * craft of the job, which is the conflict the 0.2 PM weight exists to
 * contain.
 */
export function resolveSlot(input: {
  userId: string;
  assigned: ReviewSlot | null;
  isContributor: boolean;
}): ReviewSlot | null {
  if (input.assigned) return input.assigned;
  return input.isContributor ? "peer" : null;
}
