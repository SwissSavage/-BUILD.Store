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
 * PEERLESS IS THE COMMON CASE, NOT THE EDGE ONE. Often it is just one
 * worker and one admin, and that is exactly why the threshold sits at
 * four: a two- or three-person engagement cannot fill its own peer
 * slot and the control is there for it.
 *
 * What does not happen is four admins around a single contributor, so
 * there is no second branch for a count that passes while the subject
 * is still peerless. I wrote one, then described the whole situation
 * as a case that does not occur, which was wrong — the rule covers
 * peerlessness through the count, it just does not need a second
 * route to the same place.
 *
 * The genuinely unlikely shape is a worker and a client with no admin
 * at all, which would mean somebody sourced and ran a deal
 * single-handed.
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
 * Resolve a rating into its slot.
 *
 * Assignment wins where it exists. Otherwise the natural reading:
 * somebody who did delivery work is a peer, and somebody who ran the
 * engagement is PM.
 *
 * ── ADMINS DEFAULT TO PM, THEY ARE NOT DROPPED ──
 *
 * This used to return null for anyone who was not a contributor, so
 * an admin's review counted for nothing unless somebody assigned them
 * a slot. Jamar: "the review I left is showing as peer when I'm a
 * project manager."
 *
 * Two bugs in one sentence. His review was landing in the peer slot
 * because the reviews page built the blend with its own mapping
 * instead of calling this; and once it did call this, the answer
 * would have been to discard his rating entirely.
 *
 * Neither is right. The PM slot exists precisely to carry the view of
 * the person who ran it, weighted 0.2 because they are a party to the
 * outcome. Dropping that view is not caution, it is throwing away the
 * signal the slot was built for.
 *
 * What stays true is that an admin is not a PEER. Their read on craft
 * counts only when somebody says it should, which is what an explicit
 * assignment is for — Rob on a design deliverable.
 */
export function resolveSlot(input: {
  userId: string;
  assigned: ReviewSlot | null;
  isContributor: boolean;
}): ReviewSlot | null {
  if (input.assigned) return input.assigned;
  return input.isContributor ? "peer" : "pm";
}
