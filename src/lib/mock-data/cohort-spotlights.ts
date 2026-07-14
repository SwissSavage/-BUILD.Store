/**
 * Monthly cohort onboarding spotlights.
 *
 * The forward-looking editorial rail — "who just joined the
 * cooperative." Complements the Future Modernist of the Month
 * (backward-looking, honoring shipped work) and the annual
 * Constellation of the Year (canonizing standing).
 *
 * Sandbox seeds a rolling three-month window so the surfaces have
 * something to render. Production replaces the mock array with a
 * live query grouped by user.createdAt bucketed to onboarding month.
 *
 * Editorial voice: first-person plural, first-name basis, sparing
 * with hype. Reads like a welcome, not a press release. When a
 * builder has a Paragraph piece, link it — otherwise the
 * narrative here is the entry.
 */
import type { CohortSpotlight } from "@/lib/types";

export const MOCK_COHORT_SPOTLIGHTS: CohortSpotlight[] = [
  {
    id: "cohort_2026_07",
    periodKey: "2026-07",
    periodLabel: "July 2026",
    userIds: ["u_bayu"],
    headline: "Bayu joins the cooperative",
    narrative:
      "Bayu comes in as a Member with a design practice that spans UI/UX, brand systems, and marketing funnel. He's been shaping the visual language of the cooperative's marketing surfaces from the outside for months — now he's inside. His arrival closes the loop between how the cooperative looks and how it operates.",
    publishedAt: "2026-07-01T09:00:00Z",
    selectedByUserId: "u_jamar",
  },
  {
    id: "cohort_2026_06",
    periodKey: "2026-06",
    periodLabel: "June 2026",
    userIds: ["u_sunny"],
    headline: "Sunny signs on as Partner",
    narrative:
      "Sunny joins as a Partner co-delivering on brand, product design, and creative direction. His book runs deep — the cooperative's roster gets sharper on visual craft with him in the rotation. Member-eligible; the tier decision waits on shipped work in the cooperative rhythm.",
    publishedAt: "2026-06-05T09:00:00Z",
    selectedByUserId: "u_jamar",
  },
  {
    id: "cohort_2026_05",
    periodKey: "2026-05",
    periodLabel: "May 2026",
    userIds: ["u_bbg", "u_sahtyre"],
    headline: "Big Baby Gandhi and Sahtyre lock in",
    narrative:
      "Two cornerstones of the FM Creative Media pillar formalize their standing this month. BBG carries the head-of-creative role — the FM voice runs through his read. Sahtyre brings a catalog of releases and a scene-native perspective on how the cooperative shows up in music. Both were already shaping the work; now the cooperative structure catches up to the reality.",
    publishedAt: "2026-05-15T09:00:00Z",
    selectedByUserId: "u_jamar",
  },
];

/** Return spotlights sorted freshest first. */
export function cohortSpotlightsByRecency(): CohortSpotlight[] {
  return [...MOCK_COHORT_SPOTLIGHTS].sort((a, b) =>
    b.periodKey.localeCompare(a.periodKey),
  );
}

/** Look up a single spotlight by its period key. */
export function findCohortSpotlight(
  periodKey: string,
): CohortSpotlight | null {
  return (
    MOCK_COHORT_SPOTLIGHTS.find((s) => s.periodKey === periodKey) ?? null
  );
}

/** The most recent spotlight — for the landing page rail. */
export function latestCohortSpotlight(): CohortSpotlight | null {
  const sorted = cohortSpotlightsByRecency();
  return sorted[0] ?? null;
}
