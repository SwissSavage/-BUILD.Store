/**
 * MVP Score seed data — published snapshots for the existing member cohort.
 *
 * Sandbox illustration only. Numbers chosen to span the threshold ladder
 * so every band has at least one example for UI builds. Production swap
 * replaces this with the daily compute job hydrating from real inputs.
 *
 * Seeded penalty examples are deliberate: Rob's DataXplorer pattern (per
 * `key-people.md` 2026-06-29 sharpening) is exactly the kind of
 * compliance violation the system is meant to flag in real time. He
 * carries an active penalty here for illustrative purposes, NOT as a
 * real-world adjudication.
 *
 * REPLACE WITH: `mvp_score_snapshots` Drizzle table (one row per user per
 * weekly publish) + `mvp_compliance_penalties` table (append-only).
 */
import type { MvpCompliancePenalty, MvpScore, MvpSubRating } from "@/lib/types";
import { buildSnapshot } from "@/lib/mvp-score";

const PUBLISHED_AT = "2026-06-29T08:00:00Z";

/** Helper: build a sub-ratings object with all keys set. */
function subs(input: Partial<Record<MvpSubRating, number>>): Record<MvpSubRating, number> {
  return {
    quality: input.quality ?? 70,
    outcomes: input.outcomes ?? 70,
    reliability: input.reliability ?? 70,
    hustle: input.hustle ?? 70,
    collaboration: input.collaboration ?? 70,
    attendance: input.attendance ?? 70,
    referrals_bd: input.referrals_bd ?? 70,
  };
}

/**
 * Seeded compliance penalties. Each = -9 OVR for 90 days from
 * `appliedAt`. The `expiresAt` is `appliedAt + 90 days`. Stacks.
 */
export const MOCK_MVP_PENALTIES: MvpCompliancePenalty[] = [
  // Illustrative historical record — a 2024 penalty (fictional details,
  // representative of the covenant-violation category). Applied
  // 2024-05-15, expired 2024-08-13 — well outside the 12-month MVP
  // rolling window. Surfaces in the penalty HISTORY (auditor-visible)
  // but does NOT drag current OVR. Demonstrates the rolloff behavior of
  // the DnD-Exhaustion mechanic: each penalty is time-bounded; the
  // mechanic does not preserve grudges past the 90-day window.
  {
    id: "mvp_pen_001",
    userId: "u_rob",
    appliedAt: "2024-05-15T00:00:00Z",
    expiresAt: "2024-08-13T00:00:00Z",
    ovrImpact: -9,
    reason:
      "Illustrative covenant-violation record from 2024. Resolved (penalty expired 2024-08); retained as history to exercise the audit rollup surface.",
  },
];

/**
 * Snapshot inputs per user. OVR is computed via `buildSnapshot` so the
 * weighted-sum + penalty math always matches the canonical pipeline.
 *
 * Spread across the threshold ladder for illustration:
 *   Jamar       → Champion's Court eligible (sustained high across the board)
 *   BBG         → Champion's Court eligible (creative strategy lead)
 *   Tolgay      → Future Modernist pool (strong technical, lighter on hustle)
 *   Aliza       → Promotion eligible (legacy seeded as approved member)
 *   Trevor      → Good standing (solid baseline)
 *   Michael     → Good standing
 *   Keyboard Kid → Future Modernist pool (newly Member-tier)
 *   Rob         → Probation/removal review band thanks to the -9 active penalty
 *   Chibu       → Sub-65 band (illustrative of the probation/removal end of the ladder)
 */
const SNAPSHOT_INPUTS: Array<{
  userId: string;
  subRatings: Record<MvpSubRating, number>;
  penalties?: MvpCompliancePenalty[];
  isProvisional?: boolean;
}> = [
  {
    userId: "u_jamar",
    subRatings: subs({
      quality: 95,
      outcomes: 94,
      reliability: 96,
      hustle: 97,
      collaboration: 88,
      attendance: 92,
      referrals_bd: 96,
    }),
  },
  {
    userId: "u_bbg",
    subRatings: subs({
      quality: 96,
      outcomes: 90,
      reliability: 88,
      hustle: 90,
      collaboration: 92,
      attendance: 88,
      referrals_bd: 86,
    }),
  },
  {
    userId: "u_tolgay",
    subRatings: subs({
      quality: 92,
      outcomes: 86,
      reliability: 84,
      hustle: 78,
      collaboration: 82,
      attendance: 80,
      referrals_bd: 70,
    }),
  },
  {
    userId: "u_aliza",
    subRatings: subs({
      quality: 80,
      outcomes: 74,
      reliability: 78,
      hustle: 70,
      collaboration: 76,
      attendance: 72,
      referrals_bd: 68,
    }),
  },
  {
    userId: "u_trevor",
    subRatings: subs({
      quality: 78,
      outcomes: 72,
      reliability: 74,
      hustle: 76,
      collaboration: 80,
      attendance: 74,
      referrals_bd: 60,
    }),
  },
  {
    userId: "u_michael",
    subRatings: subs({
      quality: 76,
      outcomes: 70,
      reliability: 74,
      hustle: 72,
      collaboration: 78,
      attendance: 72,
      referrals_bd: 64,
    }),
  },
  {
    // Newly promoted from Partner → Member tier 2026-06-29. Provisional
    // until track record at Member tier accumulates. Sub-ratings still
    // recompute in the background; the surface just renders "good
    // standing — building track record" instead of OVR/band until admin
    // promotes him off provisional.
    userId: "u_keyboard_kid",
    isProvisional: true,
    subRatings: subs({
      quality: 88,
      outcomes: 82,
      reliability: 84,
      hustle: 80,
      collaboration: 78,
      attendance: 80,
      referrals_bd: 72,
    }),
  },
  {
    userId: "u_rob",
    // Sub-ratings reflect natural good-standing: solid service provider
    // (per key-people.md), ~$80k in delivered work, strong RevOps lens.
    // The 2024 DataXplorer penalty rolled off in 2024-08 and does not
    // drag his current OVR. History stays on record per memory.
    subRatings: subs({
      quality: 84,
      outcomes: 82,
      reliability: 80,
      hustle: 86,
      collaboration: 82,
      attendance: 84,
      referrals_bd: 88,
    }),
    penalties: MOCK_MVP_PENALTIES.filter((p) => p.userId === "u_rob"),
  },
  {
    userId: "u_chibu",
    subRatings: subs({
      quality: 60,
      outcomes: 40,
      reliability: 30,
      hustle: 30,
      collaboration: 45,
      attendance: 30,
      referrals_bd: 40,
    }),
  },
  {
    // Sunny — Partner-tier (recategorized 2026-07-01). Design / Brand UX
    // beta tester. Sub-ratings land in the promotion-eligible band
    // (blue TradingCard). Discovery unlocked by an active recognition.
    userId: "u_sunny",
    subRatings: subs({
      quality: 87,
      outcomes: 78,
      reliability: 82,
      hustle: 84,
      collaboration: 88,
      attendance: 82,
      referrals_bd: 70,
    }),
  },
  {
    // Bayu — Member-tier. Frontend + product design collaborator.
    // Sub-ratings land in the good-standing band (green TradingCard).
    // Contributor still ramping — outcomes weighted lighter until real
    // engagements settle.
    userId: "u_bayu",
    subRatings: subs({
      quality: 72,
      outcomes: 65,
      reliability: 74,
      hustle: 78,
      collaboration: 76,
      attendance: 72,
      referrals_bd: 60,
    }),
  },
];

export const MOCK_MVP_SCORES: MvpScore[] = SNAPSHOT_INPUTS.map((row) =>
  buildSnapshot({
    ...row,
    publishedAt: PUBLISHED_AT,
    isProvisional: row.isProvisional ?? false,
  }),
);

/** Find the published snapshot for a user, or null if not in the cohort. */
export function mvpScoreForUser(userId: string): MvpScore | null {
  return MOCK_MVP_SCORES.find((s) => s.userId === userId) ?? null;
}

/** Active penalties for a user as of now. */
export function activePenaltiesForUser(userId: string): MvpCompliancePenalty[] {
  return MOCK_MVP_PENALTIES.filter(
    (p) => p.userId === userId && p.expiresAt > new Date().toISOString(),
  );
}

/** Sort snapshots desc by OVR (sandbox helper for admin scoreboard). */
export function rankedSnapshots(): MvpScore[] {
  return [...MOCK_MVP_SCORES].sort((a, b) => b.ovr - a.ovr);
}
