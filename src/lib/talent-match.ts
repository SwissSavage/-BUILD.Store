/**
 * Talent semantic knowledge layer.
 *
 * Two halves:
 *
 *   1. Keyword scrubbing — `extractKeywords()` runs a deterministic
 *      stop-word + tokenization pass over raw text (resumes, LinkedIn
 *      snippets, inbound briefs) to produce a tag set the rest of the
 *      system can match against. Cheap to maintain. Stable enough for
 *      semantic-ish matching without an LLM in the loop.
 *
 *   2. Match scoring — `scoreTalentMatch()` ranks every cooperative
 *      member against a target tag set (pillar tags + keyword tags),
 *      so the admin triage queue can suggest who's best aligned to a
 *      new opportunity even when the inbound brief uses different
 *      vocabulary than the canon skill tags.
 *
 * Information-asymmetry posture: this layer lets the cooperative spot
 * "this RFP is really about X" before the inbound submitter explicitly
 * tags it as X, so members get a fair shot at opportunities regardless
 * of how the prompt was worded.
 *
 * Production swap (the "agentic" layer):
 *   - Keyword extraction stays deterministic for cost reasons, but the
 *     match-explain step can swap to a small LLM ("why is Aliza the
 *     match here?") triggered only on admin click — no per-submission
 *     LLM cost.
 *   - The tag table moves to a Postgres `talent_tags` join (userId,
 *     tag, source, confidence). Daily refresh job re-runs the extractor
 *     against newly added portfolio / resume artifacts.
 */
import type { Industry, User } from "@/lib/types";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { mvpScoreForUser } from "@/lib/mock-data/mvp-scores";

/**
 * Stop words excluded from extracted tag lists. Conservative — we keep
 * domain-specific shorthand (api, ux, ml, etc.) that downstream
 * matching cares about.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "with",
  "you",
  "your",
  "i",
  "i'm",
  "im",
  "our",
  "us",
  "if",
  "so",
  "do",
  "doing",
  "did",
  "want",
  "wanted",
  "wants",
  "need",
  "needed",
  "needs",
  "going",
  "go",
  "get",
  "got",
  "make",
  "made",
  "very",
  "really",
  "just",
  "also",
  "than",
  "then",
  "there",
  "here",
  "about",
  "etc",
  "ie",
  "eg",
]);

/**
 * Lightweight keyword extractor. Lower-cases, strips punctuation,
 * tokenizes on whitespace, drops stop words, dedupes, caps at 50 tags.
 * Multi-word phrases get re-joined when they appear in canonical tag
 * vocabularies (kept simple in sandbox; production swap reads from a
 * `tag_vocabulary` table).
 */
export function extractKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-+/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return Array.from(new Set(tokens)).slice(0, 50);
}

/**
 * Build a member's match tag-set by combining canonical skills,
 * discipline label, primary + secondary pillars, and keywords scrubbed
 * out of the bio.
 */
export function buildTalentTagSet(user: User): {
  pillars: Industry[];
  tags: Set<string>;
} {
  const pillars: Industry[] = [];
  if (user.primaryIndustry) pillars.push(user.primaryIndustry);
  pillars.push(...user.secondaryIndustries);

  const tags = new Set<string>();
  for (const s of user.skills) tags.add(s.toLowerCase());
  for (const t of user.talentTags ?? []) tags.add(t.toLowerCase());
  if (user.discipline) {
    for (const w of extractKeywords(user.discipline)) tags.add(w);
  }
  if (user.bio) {
    for (const w of extractKeywords(user.bio)) tags.add(w);
  }

  return { pillars, tags };
}

/**
 * Regenerate a member's `talentTags` from every text field we have on
 * them: bio, skills, discipline, portfolio URL slug. Used at onboarding
 * and on manual "rescan" from /profile or /admin/members/[id]/tags.
 *
 * Returns the new tag set rather than mutating so callers can decide
 * whether to merge with existing tags or replace.
 */
export function deriveTalentTagsFromUser(user: User): string[] {
  const acc = new Set<string>();
  for (const s of user.skills) acc.add(s.toLowerCase());
  if (user.discipline) for (const w of extractKeywords(user.discipline)) acc.add(w);
  if (user.bio) for (const w of extractKeywords(user.bio)) acc.add(w);
  if (user.portfolioUrl) {
    const slug = user.portfolioUrl
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, " ");
    for (const w of extractKeywords(slug)) acc.add(w);
  }
  return Array.from(acc).slice(0, 80);
}

export interface TalentMatchResult {
  user: User;
  /** Final score = fit × mvpFactor. Higher is better. */
  score: number;
  /** Pre-MVP fit score (0..1) — pillar + tag + discipline composite. */
  fitScore: number;
  /** Multiplier applied for MVP standing. 1.0 = neutral / no snapshot. */
  mvpFactor: number;
  /** Snapshot OVR, or null if no snapshot on file. */
  ovr: number | null;
  /** Tags that drove the match. Useful for the admin explainer panel. */
  matchedTags: string[];
  /** Pillars in common with the opportunity. */
  matchedPillars: Industry[];
}

/**
 * MVP factor curve. Members without a snapshot default to neutral (1.0)
 * so they aren't penalized for being new / Partner-tier.
 *
 *   OVR  0 → 0.5x (sub-threshold standing damps any match)
 *   OVR 50 → ~0.9x (near-neutral)
 *   OVR 65 → ~1.02x (just above probation; barely above neutral)
 *   OVR 70 → 1.07x (Member good standing)
 *   OVR 80 → 1.15x (Future Modernist pool)
 *   OVR 90 → 1.23x (Champion's Court eligible)
 *   OVR 99 → 1.3x (peak)
 *
 * Linear scaling between 0 and 99 from 0.5 to 1.3. Tunable later.
 */
export function mvpFactorForUser(userId: string): { factor: number; ovr: number | null } {
  const snapshot = mvpScoreForUser(userId);
  if (!snapshot) return { factor: 1.0, ovr: null };
  // Provisional members get neutral 1.0 — they're in good standing,
  // building track record, but their OVR isn't yet a reliable signal
  // to amplify or damp opportunity flow.
  if (snapshot.isProvisional) return { factor: 1.0, ovr: null };
  const factor = 0.5 + (snapshot.ovr / 99) * 0.8;
  return { factor, ovr: snapshot.ovr };
}

/**
 * Score every cooperative member against a target tag/pillar set.
 * Returns the top N suggestions sorted by final score.
 *
 * Fit scoring weights (sum to 1.0):
 *   - Pillar overlap         : 0.45
 *   - Tag overlap (Jaccard)  : 0.45
 *   - Discipline boost       : 0.10
 *
 * Final score = fitScore × mvpFactor. The MVP multiplier closes the
 * compliance ↔ opportunity-routing loop locked in memory: high-
 * performing members rank above weaker performers at equivalent fit;
 * members with compliance penalties dragging their OVR down get a
 * smaller share of inbound opportunity flow until they earn standing
 * back. Members without an MVP snapshot default to neutral (1.0).
 */
export function scoreTalentMatch(
  target: { pillars: Industry[]; keywordTags: string[] },
  limit = 8,
): TalentMatchResult[] {
  const targetPillars = new Set(target.pillars);
  const targetTags = new Set(target.keywordTags.map((t) => t.toLowerCase()));

  const results: TalentMatchResult[] = MOCK_USERS
    .filter((u) => !u.isAdmin || true) // include admins; they take work too
    .map((user) => {
      const { pillars, tags } = buildTalentTagSet(user);

      const matchedPillars = pillars.filter((p) => targetPillars.has(p));
      const pillarScore =
        targetPillars.size === 0
          ? 0
          : matchedPillars.length / targetPillars.size;

      const matchedTags = Array.from(tags).filter((t) => targetTags.has(t));
      const union = new Set<string>([...tags, ...targetTags]);
      const tagScore = union.size === 0 ? 0 : matchedTags.length / union.size;

      const disciplineLower = (user.discipline ?? "").toLowerCase();
      const disciplineHit = Array.from(targetTags).some((t) =>
        disciplineLower.includes(t),
      );
      const disciplineBoost = disciplineHit ? 1 : 0;

      const fitScore =
        0.45 * pillarScore + 0.45 * tagScore + 0.1 * disciplineBoost;

      const { factor: mvpFactor, ovr } = mvpFactorForUser(user.id);
      const score = fitScore * mvpFactor;

      return {
        user,
        score,
        fitScore,
        mvpFactor,
        ovr,
        matchedTags,
        matchedPillars,
      };
    })
    .filter((r) => r.fitScore > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

/**
 * Fair-shake match dispatch (task #40). Returns a MIX for the admin
 * dispatch queue — top-ranked candidates + a rotation slot for
 * newer/less-utilized talent + an alphabet-fair shuffle so the same
 * heavy hitters don't get every RFP.
 *
 * Split (default limit=8):
 *   - 4 slots: top by scoreTalentMatch fit
 *   - 2 slots: rotation — lowest recent-engagement count among
 *     fitScore > 0 candidates, giving newer talent shots
 *   - 2 slots: alphabet-fair — pulled from the remaining pool
 *     ordered by first-letter distance from the most-recent RFP's
 *     picks so different names surface engagement to engagement
 *
 * Every returned entry carries a `bucket` label ("top" | "rotation"
 * | "alphabet") so the admin surface can show the mix intent.
 */
export interface FairMixMember extends TalentMatchResult {
  bucket: "top" | "rotation" | "alphabet";
}

export function fairMixTalentForRfp(
  target: { pillars: Industry[]; keywordTags: string[] },
  options: {
    limit?: number;
    // Rotation seed — count of engagements per userId, so we can
    // prefer the least-utilized among matched candidates. Caller
    // computes this from project_applications + assignedMemberIds.
    // Empty map = everyone treated as un-engaged (fine for MVP).
    engagementCountByUserId?: Map<string, number>;
    // Alphabet-fair seed — first letters of names picked on recent
    // dispatches, so we bias away from them. Empty = neutral.
    recentPickInitials?: Set<string>;
  } = {},
): FairMixMember[] {
  const limit = options.limit ?? 8;
  const engagementCounts = options.engagementCountByUserId ?? new Map();
  const recentInitials = options.recentPickInitials ?? new Set();

  // Pull a wide pool so we have candidates to slot into each bucket.
  const pool = scoreTalentMatch(target, Math.max(limit * 3, 24));

  const topN = Math.ceil(limit * 0.5);
  const rotationN = Math.floor(limit * 0.25);
  const alphabetN = limit - topN - rotationN;

  const top = pool.slice(0, topN);
  const topIds = new Set(top.map((r) => r.user.id));

  const remaining = pool.filter((r) => !topIds.has(r.user.id));

  const rotation = [...remaining]
    .sort((a, b) => {
      const ca = engagementCounts.get(a.user.id) ?? 0;
      const cb = engagementCounts.get(b.user.id) ?? 0;
      if (ca !== cb) return ca - cb; // fewer engagements first
      return b.score - a.score;
    })
    .slice(0, rotationN);
  const rotationIds = new Set(rotation.map((r) => r.user.id));

  const alphabet = [...remaining]
    .filter((r) => !rotationIds.has(r.user.id))
    .sort((a, b) => {
      const ai = (a.user.firstName ?? "?")[0].toUpperCase();
      const bi = (b.user.firstName ?? "?")[0].toUpperCase();
      const aRecent = recentInitials.has(ai) ? 1 : 0;
      const bRecent = recentInitials.has(bi) ? 1 : 0;
      if (aRecent !== bRecent) return aRecent - bRecent; // un-recent first
      return b.score - a.score;
    })
    .slice(0, alphabetN);

  return [
    ...top.map((r) => ({ ...r, bucket: "top" as const })),
    ...rotation.map((r) => ({ ...r, bucket: "rotation" as const })),
    ...alphabet.map((r) => ({ ...r, bucket: "alphabet" as const })),
  ];
}
