/**
 * Half-star ratings, and the rule that a sub-maximum score owes a
 * reason.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS (2026-11-24)
 *
 * Three rating forms — peer, admin and client — each had their own
 * scale handling, their own star markup and their own validation. That
 * is three places to change a scale and three places for them to
 * disagree, which is the silo pattern I keep producing: a module per
 * surface rather than one rule with several doors.
 *
 * So the scale, the parsing, the validation and the enforcement of the
 * reason rule all live here, and every form and every server action
 * reads from it.
 *
 * ─────────────────────────────────────────────────────────────
 * THE STORAGE
 *
 * Half-stars on a 1.0-5.0 scale, stored as integer half-steps 2..10.
 * Not numeric: node-postgres returns numeric as a string, which broke
 * three money pages in #94, and these columns now feed a payout
 * decision. See drizzle/0054 for the full account.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A SUB-MAXIMUM SCORE REQUIRES A REASON
 *
 * Jamar's rule: for any section not scoring the maximum, say what
 * could have been done better. If that cannot be articulated, the
 * rating should be higher.
 *
 * This is not bureaucracy, it is what makes the instrument work. A
 * five-point scale with no cost to using the middle collects
 * impressions, and the person being rated learns a number instead of
 * something they can act on. Requiring the sentence does two things at
 * once: it filters out scores nobody can justify, and it turns the
 * ones that remain into feedback.
 *
 * SKIPPING IS NOT SCORING LOW. A reviewer who had no scoping
 * conversation should say nothing about scope clarity, and null means
 * "did not answer" — the aggregate skips it, and no reason is owed. A
 * forced answer is noise dressed as data. The reason is owed for
 * answering BELOW the maximum, which is a claim about the work.
 *
 * NO DATABASE IMPORTS. Pure, so it crosses to client components.
 * ─────────────────────────────────────────────────────────────
 */

/** Integer half-steps. 2 = 1.0 stars, 10 = 5.0 stars. */
export const HALF_STEP_MIN = 2;
export const HALF_STEP_MAX = 10;

/** Every selectable value, low to high. */
export const HALF_STEPS: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/** 7 -> 3.5 */
export function toStars(halfSteps: number): number {
  return halfSteps / 2;
}

/** 3.5 -> 7 */
export function toHalfSteps(stars: number): number {
  return Math.round(stars * 2);
}

/** "3.5" / "4" for display. */
export function formatStars(halfSteps: number): string {
  const s = toStars(halfSteps);
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

export function isHalfStep(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= HALF_STEP_MIN &&
    n <= HALF_STEP_MAX
  );
}

/**
 * Parse one rating off a form.
 *
 * Returns null for an empty value, which is a deliberate skip and not
 * a low score. Returns null for anything out of range too: a form
 * cannot be trusted to send a valid half-step, and a silently clamped
 * rating is worse than a missing one.
 */
export function parseHalfStep(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return isHalfStep(n) ? n : null;
}

/**
 * The 0-99 sub-rating scale used by MVP_WEIGHTS.
 *
 * Was x19.8 against a 1-5 maximum. Half-steps make the maximum 10, so
 * it is x9.9. Both land a perfect score on 99, which is the OVR clamp.
 */
export const HALF_STEP_TO_SUB_RATING = 9.9;

// ── The reason rule ──────────────────────────────────────────

/** A reason is owed when a reviewer answered, and answered below 10. */
export function reasonRequired(halfSteps: number | null): boolean {
  return halfSteps !== null && halfSteps < HALF_STEP_MAX;
}

/**
 * Shortest reason that can carry any information.
 *
 * Deliberately low. The point is to make somebody articulate the
 * thing, not to hit a word count, and a long minimum just teaches
 * people to pad. "Brief was never written down" is a complete and
 * useful answer at 26 characters.
 */
export const REASON_MIN_LENGTH = 12;

export interface ReasonCheck {
  ok: boolean;
  /** Axes that scored below the maximum with no usable reason. */
  missing: string[];
  message: string;
}

/**
 * Validate a whole submission's scores against its reasons.
 *
 * Called from the server action, not only the form. A hidden field is
 * not a validation and a client that skips the check is a client
 * somebody wrote on purpose.
 */
export function checkReasons(
  entries: Array<{
    axis: string;
    label: string;
    halfSteps: number | null;
    reason: string | null;
  }>,
): ReasonCheck {
  const missing: string[] = [];
  const labels: string[] = [];
  for (const e of entries) {
    if (!reasonRequired(e.halfSteps)) continue;
    const r = (e.reason ?? "").trim();
    if (r.length < REASON_MIN_LENGTH) {
      missing.push(e.axis);
      labels.push(e.label);
    }
  }
  if (missing.length === 0) {
    return { ok: true, missing: [], message: "" };
  }
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return {
    ok: false,
    missing,
    message: `Say what would have been better on ${list}. If you cannot name it, the rating should be higher — or skip the question.`,
  };
}

/**
 * Keep only the reasons that belong to a sub-maximum answer.
 *
 * A reason attached to a perfect score, or to a skipped axis, is
 * dropped rather than stored. Otherwise a reviewer who types a
 * complaint and then moves the score to 10 leaves the complaint on the
 * record attached to nothing.
 */
export function pruneReasons(
  entries: Array<{
    axis: string;
    halfSteps: number | null;
    reason: string | null;
  }>,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (!reasonRequired(e.halfSteps)) continue;
    const r = (e.reason ?? "").trim();
    if (r.length > 0) out[e.axis] = r;
  }
  return Object.keys(out).length > 0 ? out : null;
}
