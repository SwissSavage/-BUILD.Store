/**
 * What somebody did on an engagement, and therefore what they can be
 * asked about.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-23)
 *
 * Jamar: "Reviews must reflect roles so people are not evaluated
 * outside of their scope."
 *
 * Before this, every admin on an engagement carried all four PM axes,
 * so reviewers were asked whether Rob paid on time. He never touched
 * payments; Jamar did. A rating gathered on work somebody did not do
 * is not a weak signal, it is a false one attached to a real person,
 * and it feeds their standing.
 *
 * ── NOBODY IS EVER ASKED ABOUT THEIR OWN ROLE ──
 *
 * Worth stating because I kept writing it the other way round. A role
 * is an admin's record of what a person DID, and it decides which
 * questions OTHER people are asked ABOUT them. Nobody fills in a form
 * about themselves anywhere in this system. "You keep framing the
 * question like people will be questioned about their own roles. That
 * is never the case."
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THE MAPPING LIVES HERE AND NOT IN THE DATABASE
 *
 * Which axis belongs to which role is product judgement. It will
 * change as the cooperative learns what it actually wants to know,
 * and a CHECK constraint is a bad place to keep an opinion. The
 * schema enforces that a role is one of the six; this file decides
 * what each one answers for.
 *
 * ─────────────────────────────────────────────────────────────
 * SCOPE IS DECLARED, NEVER INFERRED
 *
 * Jamar: "Rob doesn't handle payments, that should be made clear at
 * role assignment not left to be inferred by questions."
 *
 * I tried two wrong answers before this one. First, no roles meant no
 * form at all, which made assignment a mandatory step and stopped
 * review rounds on engagements nobody had configured. Then, no roles
 * meant every axis except payment — a guess about which questions are
 * fair, dressed up as a default.
 *
 * Both were attempts to work out scope from somewhere other than the
 * person who knows it. What somebody did on an engagement is a fact
 * one person can state in five seconds and no amount of defaulting
 * can derive.
 *
 * So axesFor returns nothing without roles, and the surface that
 * collects reviews puts the assignment control next to the person who
 * has none. Not mandatory in advance, which is what "optional" meant:
 * assignable at the moment it matters, by whoever is already looking
 * at the engagement.
 *
 * NO DATABASE IMPORTS. Pure, so it can cross to a client component.
 * The MvpSubRating import is type-only AND lib/types.ts reaches
 * nothing under src/db, which is what check-client-boundary needs —
 * it rejects a type-only import too when the module behind it can
 * reach the database client.
 * ─────────────────────────────────────────────────────────────
 */
import type { MvpSubRating } from "@/lib/types";

export type EngagementRole =
  | "client_owner"
  | "delivery_oversight"
  | "advisory"
  | "sourcing"
  | "coordination"
  | "payments";

export type ReviewAxis =
  | "scopeClarity"
  | "responsiveness"
  | "shieldedFromChurn"
  | "paidOnTime";

/**
 * ─────────────────────────────────────────────────────────────
 * WHERE AN ANSWER GOES (2026-11-23)
 *
 * Jamar: "No admin subratings, the original scores cover all of
 * this, we can use examples in the questions."
 *
 * My first pass gave admin reviews their own synthesized score. That
 * was the mistake: a review exists to move OVR, so an instrument that
 * produces a number nothing reads measures nothing. An admin could
 * run an engagement badly, be rated for it, and their standing would
 * not move.
 *
 * None of these four axes needs a new dimension. Each lands on a
 * sub-rating whose definition in lib/types.ts already describes it:
 *
 *   scopeClarity      → communication  "clarity, cadence, keeping the
 *                                       room informed"
 *   responsiveness    → hustle         "inbound response time"
 *   shieldedFromChurn → collaboration  how someone works WITH people
 *   paidOnTime        → reliability    "milestone-hit + deadline"
 *
 * WHAT THEY DELIBERATELY DO NOT FEED
 *
 * outcomes, attendance and referrals_bd. Those three are meant to be
 * counted — bonus-gate clear rate, the minutes rail, referrer
 * attributions converted to revenue — and asking somebody to rate
 * them replaces a fact with an impression. quality is left to peer
 * review because it is about the work, and an admin's contribution to
 * it is already captured by whether the scope was clear.
 * ─────────────────────────────────────────────────────────────
 */
export const AXIS_SUB_RATING: Record<ReviewAxis, MvpSubRating> = {
  scopeClarity: "communication",
  responsiveness: "hustle",
  shieldedFromChurn: "collaboration",
  paidOnTime: "reliability",
};

export interface ReviewAxisDefinition {
  axis: ReviewAxis;
  label: string;
  /** The question, in the reviewer's words. */
  question: string;
  /**
   * A concrete instance, because a five-star scale with no anchor
   * collects politeness. Jamar: "we can use examples in the
   * questions."
   */
  example: string;
}

export const REVIEW_AXES: ReviewAxisDefinition[] = [
  {
    axis: "scopeClarity",
    label: "Scope clarity",
    question: "Was it clear what you were being asked to do?",
    example:
      "A 5 is you knew what done looked like before you started. A 2 is you found out what was wanted by getting it wrong first.",
  },
  {
    axis: "responsiveness",
    label: "Responsiveness",
    question: "Did they come back to you when you needed them?",
    example:
      "A 5 is a blocker answered the same day. A 2 is work stopped while you waited.",
  },
  {
    axis: "shieldedFromChurn",
    label: "Handling change",
    question: "Did they absorb client changes rather than passing them straight through?",
    example:
      "A 5 is the client changed their mind and you heard one considered decision. A 2 is you rebuilt it twice because every wobble reached you raw.",
  },
  {
    axis: "paidOnTime",
    label: "Paid on time",
    question: "Did the money arrive when it was supposed to?",
    example:
      "A 5 is it landed on the date you were given. A 2 is you had to ask more than once.",
  },
];

export function axisDefinition(axis: string): ReviewAxisDefinition | null {
  return REVIEW_AXES.find((a) => a.axis === axis) ?? null;
}

export interface EngagementRoleDefinition {
  role: EngagementRole;
  label: string;
  /** Shown next to the checkbox when an admin assigns roles. */
  describes: string;
  /** What a reviewer may be asked about somebody holding this role. */
  axes: ReviewAxis[];
}

export const ENGAGEMENT_ROLES: EngagementRoleDefinition[] = [
  {
    role: "client_owner",
    label: "Client owner",
    describes: "Brought in the client and holds the relationship.",
    // They set the expectation the work is measured against, and they
    // are the one a client chases. Not payments.
    axes: ["scopeClarity", "responsiveness", "shieldedFromChurn"],
  },
  {
    role: "delivery_oversight",
    label: "Delivery oversight",
    describes: "Directs the work, drives changes, judges quality.",
    axes: ["scopeClarity", "responsiveness", "shieldedFromChurn"],
  },
  {
    role: "advisory",
    label: "Advisory",
    describes: "Advised without directing the work or owning the outcome.",
    // Answerable for being reachable and for shaping what the work
    // was meant to be. Not for change decisions they did not make,
    // and not for money.
    axes: ["scopeClarity", "responsiveness"],
  },
  {
    role: "sourcing",
    label: "Sourcing",
    describes: "Found the talent and placed them on this engagement.",
    // Whether the brief they handed the Builder was clear, and
    // whether they could be reached about it.
    axes: ["scopeClarity", "responsiveness"],
  },
  {
    role: "coordination",
    label: "Coordination",
    describes: "Ran communication between the parties.",
    // Absorbing churn is most of this job: a coordinator who passes
    // every client wobble straight through has not done it.
    axes: ["responsiveness", "shieldedFromChurn"],
  },
  {
    role: "payments",
    label: "Payments",
    describes: "Sent and tracked the money.",
    // The only role that answers for this, which is the whole reason
    // the file exists.
    axes: ["responsiveness", "paidOnTime"],
  },
];

/**
 * ─────────────────────────────────────────────────────────────
 * CONTRIBUTOR ROLES
 *
 * The six above describe RUNNING an engagement. Pointing them at the
 * people who did the work asked reviewers whether a designer handled
 * payments, which is how Ozy's role came out misattributed.
 *
 * Delivery has its own shape, and it is not a mirror of management.
 * Craft, reliability, collaboration and communication apply to anyone
 * who delivered, so those need no gating. What does vary is
 * accountability for the outcome:
 *
 * Jamar: "a delivery lead is ultimately in part responsible for what
 * gets delivered if their failure to communicate is what caused a
 * poor outcome that needs documentation."
 *
 * So a delivery lead carries one axis a contributor does not — whether
 * they held the delivery together — and it is a question put to the
 * people around them, never to the lead.
 * ─────────────────────────────────────────────────────────────
 */
export type ContributorRole = "delivery_lead" | "contributor";

export interface ContributorRoleDefinition {
  role: ContributorRole;
  label: string;
  describes: string;
  /** Extra axes this role makes answerable, beyond the peer four. */
  axes: ContributorAxis[];
}

/** Asked of the people around a delivery lead, never of the lead. */
export type ContributorAxis = "heldDeliveryTogether";

export const CONTRIBUTOR_ROLES: ContributorRoleDefinition[] = [
  {
    role: "delivery_lead",
    label: "Delivery lead",
    describes:
      "Accountable for what shipped. Directed or coordinated the delivery work.",
    axes: ["heldDeliveryTogether"],
  },
  {
    role: "contributor",
    label: "Contributor",
    describes: "Delivered a defined piece of the work.",
    // Nothing extra. Craft, reliability, collaboration and
    // communication already cover doing the work, and inventing more
    // questions for a plain contributor would be asking reviewers to
    // split hairs they cannot see.
    axes: [],
  },
];

export const CONTRIBUTOR_AXES: {
  axis: ContributorAxis;
  label: string;
  question: string;
  example: string;
}[] = [
  {
    axis: "heldDeliveryTogether",
    label: "Held delivery together",
    question:
      "Did they keep the work joined up, or did you find out too late?",
    example:
      "A 5 is you always knew where the work stood and what was changing. A 2 is you learned about a problem when it had already cost you time.",
  },
];

export function contributorRoleDefinition(
  role: string,
): ContributorRoleDefinition | null {
  return CONTRIBUTOR_ROLES.find((r) => r.role === role) ?? null;
}

/** Extra axes somebody carries by virtue of how they delivered. */
export function contributorAxesFor(roles: string[]): ContributorAxis[] {
  const seen = new Set<ContributorAxis>();
  for (const r of roles) {
    for (const a of contributorRoleDefinition(r)?.axes ?? []) seen.add(a);
  }
  return [...seen];
}

export function roleDefinition(
  role: string,
): EngagementRoleDefinition | null {
  return ENGAGEMENT_ROLES.find((r) => r.role === role) ?? null;
}

/** Canonical order, used for display and for the unassigned default. */
const ALL_AXES: ReviewAxis[] = [
  "scopeClarity",
  "responsiveness",
  "shieldedFromChurn",
  "paidOnTime",
];

/**
 * The union of axes for everything this person did.
 *
 * Empty without roles, and the caller must treat that as "assign
 * roles first" rather than substituting a guess. See the header.
 */
export function axesFor(roles: string[]): ReviewAxis[] {
  if (roles.length === 0) return [];
  const seen = new Set<ReviewAxis>();
  for (const r of roles) {
    for (const axis of roleDefinition(r)?.axes ?? []) seen.add(axis);
  }
  // Returned in a stable order so a form does not reshuffle between
  // renders for two people holding the same roles in a different
  // sequence.
  return ALL_AXES.filter((a) => seen.has(a));
}

/**
 * Whether an answer on this axis is admissible for somebody holding
 * these roles.
 *
 * Checked in the action as well as the form. A server action is a
 * public endpoint, so hiding a field is not the same as refusing the
 * value, and the whole point here is that an out-of-scope rating
 * never reaches somebody's record.
 */
export function axisInScope(roles: string[], axis: ReviewAxis): boolean {
  return axesFor(roles).includes(axis);
}

/** "Client owner and Delivery oversight", for a review form heading. */
export function describeRoles(roles: string[]): string {
  const labels = roles
    .map((r) => roleDefinition(r)?.label)
    .filter((l): l is string => Boolean(l));
  // Said plainly rather than left blank: an admin seeing this knows
  // the questions were not narrowed, and can assign roles if that
  // matters on this engagement.
  if (labels.length === 0) return "No role assigned";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
