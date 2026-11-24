/**
 * Reviews become a score. Who said what does not travel with it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-23)
 *
 * Jamar: "reviews should also just synthesize into a score instead of
 * having visibility on attribution so that people's ratings don't
 * effect how they rate each other due to personal concerns."
 *
 * The failure he is describing is reciprocity. If I can see that you
 * rated me three, my rating of you stops being about your work. The
 * ratings converge on polite and the whole instrument stops measuring
 * anything. That is not a hypothetical in a small cooperative where
 * everyone works with everyone.
 *
 * So the subject of a review never receives rows. They receive a
 * number, counts, and nothing that distinguishes one reviewer's
 * answer from another's.
 *
 * Then: "but member admins should be able to access data." Which is
 * already the peer-review posture — /admin/peer-reviews renders
 * reviewer names behind requireAdmin deliberately, because a
 * compliance flag that cannot be traced to a person cannot be acted
 * on.
 *
 * ─────────────────────────────────────────────────────────────
 * THE COLLISION THAT ONLY EXISTS HERE
 *
 * On a peer review the subject is a Builder and the attributed view
 * is an admin surface, so the two rules do not meet. On an ADMIN
 * review the subject IS an admin. "Admins may see attributed data"
 * and "the subject may not see who rated them" are the same person.
 *
 * excludeSubject below is the answer: an admin looking at the
 * attributed list never sees rows about themselves, only their own
 * synthesized score, the same as everybody else. It has to be
 * enforced in the reader rather than trusted to a page, because the
 * moment it is a UI concern somebody will write a second page.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY PROSE IS NOT IN THE SCORE
 *
 * Free text is identifying. On an engagement with one Builder it
 * names the author however carefully it is written, and on three it
 * usually does. Prose is therefore admin-only and never surfaces to
 * the subject, even unattributed.
 *
 * ─────────────────────────────────────────────────────────────
 * THIS IS A BREAKDOWN, NOT A STANDING (corrected 2026-11-23)
 *
 * As first written this was the only thing admin reviews fed, which
 * made it a parallel scoring system: a number nothing read, while OVR
 * — the score that actually gates promotion, Champion's Court and the
 * bonus composite — ignored admin reviews entirely. An admin could
 * run an engagement badly, be rated for it by everyone on it, and
 * their standing would not move.
 *
 * Jamar: "No admin subratings, the original scores cover all of this."
 *
 * Standing now comes from OVR for admins exactly as for Builders:
 * writers/mvp-score.ts folds these four axes into communication,
 * hustle, collaboration and reliability through AXIS_SUB_RATING in
 * lib/engagement-roles.ts.
 *
 * What survives here is the per-axis read: useful for a subject who
 * wants to know WHICH part of running an engagement people marked
 * down, which a single OVR cannot tell them. Treat the mean as
 * diagnostic. Nothing should gate on it.
 *
 * NO DATABASE IMPORTS. Pure, so the arithmetic can be checked without
 * a connection and the shapes can cross to a client component.
 * ─────────────────────────────────────────────────────────────
 */
import type { AdminReview } from "@/lib/types";

export interface AdminScoreAxis {
  key: "scopeClarity" | "responsiveness" | "shieldedFromChurn" | "paidOnTime";
  label: string;
  /** Null when nobody answered this axis. */
  mean: number | null;
  /** How many reviewers answered it, not how many reviews exist. */
  answers: number;
}

export interface AdminScore {
  /** Mean of the answered axes, 1..5. Null when there is nothing yet. */
  overall: number | null;
  axes: AdminScoreAxis[];
  /** Total reviews behind the score. */
  reviews: number;
  fromBuilders: number;
  fromClients: number;
  /**
   * Whether there is enough here to show anyone.
   *
   * Two is the floor. A single review is not a rating, it is one
   * person's opinion wearing a number, and on a small roster showing
   * a score built from one review identifies its author as surely as
   * signing it would.
   */
  publishable: boolean;
}

const AXES: { key: AdminScoreAxis["key"]; label: string }[] = [
  { key: "scopeClarity", label: "Scope clarity" },
  { key: "responsiveness", label: "Responsiveness" },
  { key: "shieldedFromChurn", label: "Handling change" },
  { key: "paidOnTime", label: "Paid on time" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Collapse reviews into a score and nothing else.
 *
 * Takes whole AdminReview rows because callers already have them, and
 * deliberately returns a shape with no ids on it at all: a surface
 * cannot leak attribution it was never handed.
 */
export function synthesizeAdminScore(reviews: AdminReview[]): AdminScore {
  const axes: AdminScoreAxis[] = AXES.map(({ key, label }) => {
    // Null means "did not answer", which is not the middle of the
    // scale, so it is skipped rather than counted as a 3.
    const given = reviews
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");
    return {
      key,
      label,
      mean: given.length > 0 ? round1(given.reduce((a, b) => a + b, 0) / given.length) : null,
      answers: given.length,
    };
  });

  // Mean of the axis means, not of every rating. Otherwise an axis
  // everybody answered outweighs one only two people did, and the
  // overall silently becomes a measure of which questions are easy.
  const answered = axes.filter((a) => a.mean !== null) as (AdminScoreAxis & {
    mean: number;
  })[];

  return {
    overall:
      answered.length > 0
        ? round1(answered.reduce((a, b) => a + b.mean, 0) / answered.length)
        : null,
    axes,
    reviews: reviews.length,
    fromBuilders: reviews.filter((r) => r.source === "builder").length,
    fromClients: reviews.filter((r) => r.source === "client").length,
    publishable: reviews.length >= 2,
  };
}

/**
 * Strip every review the viewer is the subject of.
 *
 * Call this on any attributed admin surface. An admin reading the
 * attributed list sees everyone's reviews except the ones about
 * themselves, because being able to look up who rated you is exactly
 * the reciprocity this is built to prevent, and "they are an admin"
 * does not make it a different problem.
 *
 * Their own standing is still available to them as a score, through
 * synthesizeAdminScore, same as everybody else.
 */
export function excludeSubject(
  reviews: AdminReview[],
  viewerUserId: string,
): AdminReview[] {
  return reviews.filter((r) => r.subjectUserId !== viewerUserId);
}

/**
 * The score with no rows attached, for showing a subject their own
 * standing. Convenience so a caller cannot accidentally hand the
 * rows to the same template.
 */
export function ownStanding(
  reviews: AdminReview[],
  subjectUserId: string,
): AdminScore {
  return synthesizeAdminScore(
    reviews.filter((r) => r.subjectUserId === subjectUserId),
  );
}
