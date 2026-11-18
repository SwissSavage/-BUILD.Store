/**
 * Carry what someone wrote on their application onto their account.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-16)
 *
 * Jamar: "We also need to have the option to associate applications to
 * existing accounts with an automated merge since we have folks that
 * accepted invite that went through the signup."
 *
 * There were never duplicate accounts. /signup writes an
 * inbound_submissions row and nothing else; invite acceptance writes
 * the users row. reconcileInboundForNewMember already finds the
 * stranded application by email and closes it, which is why nobody
 * noticed the real problem: it closes the ticket and throws away
 * everything written on it.
 *
 * So the app asks a person to describe their skills and their work,
 * files that in a queue, creates their account without a word of it,
 * and then needs a hand-written email asking them to type it all in
 * again. Ari Kamlani got that email. His skills were already sitting
 * in the database when it was sent.
 *
 * This is the same wound as #112, where invite_links.target_name is
 * written at invite time and never read, so accounts land unnamed.
 * Both are "we already had this and did not use it".
 *
 * ─────────────────────────────────────────────────────────────
 * THE CONFLICT RULE: THE MEMBER ALWAYS WINS
 *
 * Decided with Jamar. Fill empty fields only. Never overwrite.
 *
 * It is not a close call. An application is a snapshot of what
 * somebody wrote on one day before they had an account; the profile is
 * what they have said about themselves since. Rob set an alias and
 * filled his profile out properly. A merge that let a months-old form
 * submission win would quietly undo that, and the member would have no
 * idea why their profile changed.
 *
 * Skills are the exception to "fill if blank", and union rather than
 * replace is still the member winning: they keep everything they
 * listed and gain anything the application had that they had not got
 * round to adding.
 *
 * WHAT IS DELIBERATELY NOT MERGED
 *
 * proposedKeywordTags. Those are tags the applicant typed freehand
 * that no admin has vetted, and the whole point of keeping them in a
 * separate column is that the matcher never sees them until somebody
 * approves them. Merging them onto a profile would launder an
 * unvetted tag into canonical data through the back door.
 *
 * talentPortfolioUrl is absent for a duller reason: handleSignup reads
 * it off the form and sends it to HubSpot, but never writes it to the
 * submission row, so there is nothing here to merge. Worth fixing at
 * the source before trying to carry it across.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A PLANNER RATHER THAN A FUNCTION THAT JUST WRITES
 *
 * planMerge is pure and returns the changes it WOULD make. That means
 * an admin can be shown exactly what is about to happen to somebody
 * else's profile before agreeing to it, the audit log can record the
 * same structure that was applied, and the rules above can be tested
 * without a database. A merge that writes silently is one nobody can
 * check afterwards.
 *
 * NO DATABASE IMPORTS. Shared with admin UI that may be client-side.
 * ─────────────────────────────────────────────────────────────
 */
import type { Industry } from "@/lib/types";

const INDUSTRIES: readonly string[] = [
  "stem",
  "creative-media",
  "professional-services",
];

/** The bits of a submission a merge can draw on. */
export interface MergeSourceApplication {
  id: string;
  kind: string;
  submitter: string | null;
  submitterEmail: string | null;
  keywordTags: string[];
  pillarTags: string[];
  body: string | null;
}

/** The bits of an account a merge can write to. */
export interface MergeTargetUser {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  skills: string[];
  primaryIndustry: string | null;
  secondaryIndustries: string[];
}

export interface MergeChange {
  field: keyof MergeTargetUser;
  /** For the admin preview and the audit entry. */
  label: string;
  from: string | string[] | null;
  to: string | string[];
  /** Why this one was allowed, in words an admin can check. */
  rule: "filled a blank" | "added to the list";
}

export interface MergePlan {
  changes: MergeChange[];
  /** Fields the application had something for, left alone. */
  skipped: { label: string; because: string }[];
}

function blank(v: string | null | undefined): boolean {
  return !v || v.trim().length === 0;
}

/** "Ari Kamlani" → first "Ari", last "Kamlani". One word is a first name. */
function splitName(full: string): { first: string; last: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
  };
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0),
    ),
  );
}

/**
 * What this merge would change, and what it would leave alone.
 * Returns an empty change list when there is nothing to carry across,
 * which the callers treat as "do not write, do not audit".
 */
export function planMerge(
  app: MergeSourceApplication,
  user: MergeTargetUser,
): MergePlan {
  const changes: MergeChange[] = [];
  const skipped: MergePlan["skipped"] = [];

  // ── Name ────────────────────────────────────────────────
  const submitted = (app.submitter ?? "").trim();
  if (submitted.length > 0) {
    const { first, last } = splitName(submitted);
    if (first && blank(user.firstName)) {
      changes.push({
        field: "firstName",
        label: "First name",
        from: user.firstName,
        to: first,
        rule: "filled a blank",
      });
    } else if (first && !blank(user.firstName)) {
      skipped.push({
        label: "First name",
        because: `already set to "${user.firstName?.trim()}"`,
      });
    }
    if (last && blank(user.lastName)) {
      changes.push({
        field: "lastName",
        label: "Last name",
        from: user.lastName,
        to: last,
        rule: "filled a blank",
      });
    }
    // Auth.js `name` is what several surfaces fall back to, so it is
    // worth filling, but only when genuinely empty.
    if (blank(user.name)) {
      changes.push({
        field: "name",
        label: "Display name",
        from: user.name,
        to: submitted,
        rule: "filled a blank",
      });
    }
  }

  // ── Skills ──────────────────────────────────────────────
  // Union, and only the admin-vetted keywordTags. See the header on
  // why proposedKeywordTags stays out.
  const incoming = normalizeTags(app.keywordTags ?? []);
  if (incoming.length > 0) {
    const have = normalizeTags(user.skills ?? []);
    const added = incoming.filter((t) => !have.includes(t));
    if (added.length > 0) {
      changes.push({
        field: "skills",
        label: "Skills",
        from: user.skills ?? [],
        // Preserve the member's own casing on what they already had.
        to: [...(user.skills ?? []), ...added],
        rule: "added to the list",
      });
    } else {
      skipped.push({
        label: "Skills",
        because: "every tag on the application is already listed",
      });
    }
  }

  // ── Pillars ─────────────────────────────────────────────
  const pillars = (app.pillarTags ?? []).filter((p) =>
    INDUSTRIES.includes(p),
  ) as Industry[];
  if (pillars.length > 0) {
    if (blank(user.primaryIndustry)) {
      changes.push({
        field: "primaryIndustry",
        label: "Primary pillar",
        from: user.primaryIndustry,
        to: pillars[0],
        rule: "filled a blank",
      });
    } else {
      skipped.push({
        label: "Primary pillar",
        because: `already set to "${user.primaryIndustry}"`,
      });
    }

    // Everything the application listed that is not already the
    // member's primary or secondary.
    const primary = blank(user.primaryIndustry)
      ? pillars[0]
      : user.primaryIndustry;
    const haveSecondary = user.secondaryIndustries ?? [];
    const addedSecondary = pillars.filter(
      (p) => p !== primary && !haveSecondary.includes(p),
    );
    if (addedSecondary.length > 0) {
      changes.push({
        field: "secondaryIndustries",
        label: "Other pillars",
        from: haveSecondary,
        to: [...haveSecondary, ...addedSecondary],
        rule: "added to the list",
      });
    }
  }

  // ── Bio ─────────────────────────────────────────────────
  // For a join_talent_signup the body IS talentSummary: the applicant
  // describing their own work in their own words, which is the right
  // starting point for a bio and a terrible thing to overwrite one
  // with.
  const body = (app.body ?? "").trim();
  if (body.length > 0 && body !== "(no detail provided)") {
    if (blank(user.bio)) {
      changes.push({
        field: "bio",
        label: "Bio",
        from: user.bio,
        to: body,
        rule: "filled a blank",
      });
    } else {
      skipped.push({
        label: "Bio",
        because: "the member has already written one",
      });
    }
  }

  return { changes, skipped };
}

/**
 * The plan as a patch. Callers hand this straight to a Drizzle update.
 * Empty object means there is nothing to do.
 */
export function mergePatch(plan: MergePlan): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const c of plan.changes) patch[c.field] = c.to;
  return patch;
}

/** One-line summary for a triage note or an audit reason. */
export function describeMerge(plan: MergePlan): string {
  if (plan.changes.length === 0) return "Nothing to carry across.";
  return plan.changes
    .map((c) =>
      c.rule === "added to the list"
        ? `${c.label} extended`
        : `${c.label} filled in`,
    )
    .join(", ");
}

/**
 * An account an application might belong to.
 *
 * Lives here rather than beside the action that builds it because a
 * "use server" module may only export async functions, and because
 * the admin UI needs the shape without pulling in the database.
 */
export interface MergeCandidate {
  userId: string;
  handle: string;
  email: string;
  label: string;
  /** Why this one came up, shown to the admin rather than assumed. */
  evidence: string;
}
