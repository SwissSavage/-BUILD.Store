/**
 * Future Modernist recognitions — periodic spotlight ledger.
 *
 * One row per recognition (monthly winner, annual Constellation). Admin
 * picks from the metric-driven shortlist + writes the narrative. The
 * `periodKey` is the dedupe key — a single user can win the same month
 * only once.
 *
 * Seeded with one historical winner (May 2026) so the admin surface has
 * a "recent recognitions" example.
 */
import type { FutureModernistRecognition } from "@/lib/types";

/**
 * SANDBOX ILLUSTRATION ONLY — DO NOT MIGRATE TO PRODUCTION.
 *
 * Recognitions start empty at beta launch (cooperative canon starts at
 * zero). This one seeded entry unlocks Sunny's Partner-tier discovery
 * window so the homepage roster preview has tier variety across
 * TradingCard rarities. Admin selects real recognitions via
 * `/admin/mvp/recognition` in production; this row gets wiped pre-deploy
 * per production-swap-checklist §7m.
 */
export const MOCK_FUTURE_MODERNIST_RECOGNITIONS: FutureModernistRecognition[] = [
  {
    id: "fmr_sunny_2026_07",
    userId: "u_sunny",
    periodKind: "month",
    periodKey: "2026-07",
    periodLabel: "July 2026",
    narrative:
      "Sunny shipped the design pass that made the platform feel like a Future Modern thing rather than a generic SaaS. Brand-side coherence across the public surfaces landed on his read of what the cooperative signals.",
    selectedByUserId: "u_jamar",
    selectedAt: "2026-07-01T09:00:00Z",
  },
];

export function recognitionForPeriod(
  periodKey: string,
  periodKind: "month" | "year",
): FutureModernistRecognition | null {
  return (
    MOCK_FUTURE_MODERNIST_RECOGNITIONS.find(
      (r) => r.periodKey === periodKey && r.periodKind === periodKind,
    ) ?? null
  );
}

export function recognitionsForUser(userId: string): FutureModernistRecognition[] {
  return MOCK_FUTURE_MODERNIST_RECOGNITIONS.filter((r) => r.userId === userId).sort(
    (a, b) => b.selectedAt.localeCompare(a.selectedAt),
  );
}

export function recentRecognitions(limit = 12): FutureModernistRecognition[] {
  return [...MOCK_FUTURE_MODERNIST_RECOGNITIONS]
    .sort((a, b) => b.selectedAt.localeCompare(a.selectedAt))
    .slice(0, limit);
}

/**
 * Compute the canonical period key for a given date.
 *   Monthly → "YYYY-MM"
 *   Annual  → "YYYY"
 */
export function periodKeyFor(
  date: Date,
  kind: "month" | "year",
): { key: string; label: string } {
  const year = date.getUTCFullYear();
  if (kind === "year") return { key: String(year), label: String(year) };
  const month = date.getUTCMonth(); // 0-indexed
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const mm = String(month + 1).padStart(2, "0");
  return { key: `${year}-${mm}`, label: `${months[month]} ${year}` };
}

/**
 * Currently-active recognitions — current calendar month + current
 * calendar year. Surfaced on /u/[handle] when the user is the winner.
 */
export function activeRecognitionsForUser(userId: string): {
  month: FutureModernistRecognition | null;
  year: FutureModernistRecognition | null;
} {
  const now = new Date();
  const monthKey = periodKeyFor(now, "month").key;
  const yearKey = periodKeyFor(now, "year").key;
  const month =
    MOCK_FUTURE_MODERNIST_RECOGNITIONS.find(
      (r) =>
        r.userId === userId &&
        r.periodKind === "month" &&
        r.periodKey === monthKey,
    ) ?? null;
  const year =
    MOCK_FUTURE_MODERNIST_RECOGNITIONS.find(
      (r) =>
        r.userId === userId &&
        r.periodKind === "year" &&
        r.periodKey === yearKey,
    ) ?? null;
  return { month, year };
}
