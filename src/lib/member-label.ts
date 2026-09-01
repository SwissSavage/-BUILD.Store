/**
 * How a member is described in a dense slot.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS REPLACED `discipline` (2026-09-01)
 *
 * `discipline` was a single self-assigned label — "what the member
 * self-identifies as in one line", per its own type comment. It had no
 * editor anywhere, so it held whatever the seed said about someone,
 * permanently. Jamar's read "Cooperative Builder, Strategist": true,
 * and not what he sells.
 *
 * The deeper problem was the shape rather than the staleness. A single
 * label forces one answer to "what are you", and this cooperative's
 * whole position is that people carry range. Two things jammed into a
 * slot built for one is the field telling on itself.
 *
 * Pillars and skills already express range — plural by construction,
 * multi-pillar by construction, and skills do real work in the
 * matcher. So the dense slots derive from those instead. Nothing to
 * maintain, nothing to go stale, and it grows as someone adds skills.
 *
 * The tagline stays the crafted line, on surfaces with room for a
 * sentence: card face, profile hero, client-facing bid cards.
 * ─────────────────────────────────────────────────────────────
 *
 * CONTEXT ROTATION
 *
 * Skills reorder to match what's being looked at. On a contract page
 * the skills that matter to THAT contract come first, so the same
 * person reads as a data engineer on one brief and a systems
 * strategist on another — without maintaining two profiles, and
 * without the cooperative deciding which one they "are".
 *
 * Ordering only. Nothing is hidden and nothing is invented; the
 * context decides what leads, not what exists.
 */
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";

/**
 * Loose shape rather than Pick<User, ...>.
 *
 * Callers pass anything from a full User to a hand-picked Drizzle
 * select, where every column comes back nullable. Demanding the strict
 * User types would push a cast onto every call site for a function
 * whose whole job is to degrade gracefully.
 */
export interface Describable {
  primaryIndustry?: Industry | string | null;
  secondaryIndustries?: readonly (Industry | string)[] | null;
  skills?: readonly string[] | null;
  tagline?: string | null;
  membershipTier?: string | null;
}

export interface MemberLabelContext {
  /** Skills the engagement is asking for. */
  skillsRequired?: string[] | null;
  /** Pillar the engagement sits in. */
  industry?: Industry | null;
}

/** Loose token match — "AI/ML" should meet "ai", "Sales Training" "sales". */
function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 1);
}

function relevance(skill: string, wanted: string[]): number {
  if (wanted.length === 0) return 0;
  const skillTokens = tokens(skill);
  let score = 0;
  for (const w of wanted) {
    const wantedTokens = tokens(w);
    if (skill.toLowerCase() === w.toLowerCase()) {
      score += 10; // exact
      continue;
    }
    const overlap = skillTokens.filter((t) => wantedTokens.includes(t)).length;
    if (overlap > 0) score += 2 + overlap;
  }
  return score;
}

/**
 * Ordered pillars for a member — primary first, then secondaries. When
 * an engagement names a pillar, that one leads if the member holds it.
 */
export function orderedPillars(
  user: Describable,
  context?: MemberLabelContext,
): Industry[] {
  const all = [
    ...(user.primaryIndustry ? [user.primaryIndustry as Industry] : []),
    ...((user.secondaryIndustries ?? []) as Industry[]),
  ].filter((p, i, arr) => arr.indexOf(p) === i);

  const wanted = context?.industry;
  if (!wanted || !all.includes(wanted)) return all;
  return [wanted, ...all.filter((p) => p !== wanted)];
}

/**
 * Skills ordered by relevance to the engagement, stable otherwise.
 *
 * Equal-relevance skills keep their authored order rather than being
 * shuffled — a member's own ordering is a signal, and reordering it
 * for no reason makes the same profile look different on every load.
 */
export function orderedSkills(
  user: Describable,
  context?: MemberLabelContext,
): string[] {
  const skills = [...(user.skills ?? [])];
  const wanted = context?.skillsRequired ?? [];
  if (wanted.length === 0 || skills.length === 0) return skills;

  return skills
    .map((skill, index) => ({ skill, index, score: relevance(skill, wanted) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.skill);
}

/**
 * Skills that actually match the engagement, in relevance order.
 * Empty when there's no context or nothing overlaps.
 */
export function matchingSkills(
  user: Describable,
  context?: MemberLabelContext,
): string[] {
  const wanted = context?.skillsRequired ?? [];
  if (wanted.length === 0) return [];
  return [...(user.skills ?? [])]
    .map((skill, index) => ({ skill, index, score: relevance(skill, wanted) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.skill);
}

/**
 * The short label for dense slots — roster rows, list eyebrows,
 * activity entries.
 *
 * Pillar first because it's the coarsest true thing, then the skills
 * that matter here. Falls back to the tagline, then to the tier word,
 * so the slot is never empty for someone who hasn't filled anything in
 * yet.
 *
 * ON A SPECIFIC ENGAGEMENT, EVERY MATCH SHOWS. The cap is for browsing
 * — a roster row can't carry ten tags. But on an RFP or contract, the
 * question being asked is "what can this person cover here", and the
 * cooperative routinely puts one contractor on several pieces of the
 * same brief. Truncating to two there would make someone who matches
 * four look like they match two, which is the opposite of what this
 * field is for.
 */
export function memberLabel(
  user: Describable,
  context?: MemberLabelContext,
  options: { maxSkills?: number; includePillar?: boolean } = {},
): string {
  const { maxSkills = 2, includePillar = true } = options;

  const parts: string[] = [];
  if (includePillar) {
    const pillars = orderedPillars(user, context);
    if (pillars[0]) parts.push(INDUSTRY_LABELS[pillars[0]]);
  }

  const matches = matchingSkills(user, context);
  if (matches.length > 0) {
    // Engagement context: show every skill that lands, uncapped.
    parts.push(...matches);
  } else {
    parts.push(...orderedSkills(user, context).slice(0, maxSkills));
  }

  if (parts.length > 0) return parts.join(" · ");
  if (user.tagline?.trim()) return user.tagline.trim();
  return user.membershipTier === "member" ? "Member" : "Partner";
}
