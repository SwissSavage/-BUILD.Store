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
 * Before this, every admin on an engagement was asked all four PM
 * axes, so Ozy would have been asked whether Rob paid on time. He
 * never touched payments; Jamar did. A rating gathered on work
 * somebody did not do is not a weak signal, it is a false one
 * attached to a real person, and it feeds their standing.
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
 * ─────────────────────────────────────────────────────────────
 */

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
