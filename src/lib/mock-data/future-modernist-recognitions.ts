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

export const MOCK_FUTURE_MODERNIST_RECOGNITIONS: FutureModernistRecognition[] = [
  // Seeded: BBG, May 2026 — illustrative historical winner.
  {
    id: "fmr_001",
    userId: "u_bbg",
    periodKind: "month",
    periodLabel: "May 2026",
    periodKey: "2026-05",
    narrative:
      "BBG shipped the EPK system reframe in one cycle — clean ownership of the artist-tier distinction, no scope drift, and the Onesheet metrics build was on his initiative. The cooperative-equity logic he carries into Creative Strategy showed up in the architecture decisions, not just the messaging. Newsletter 2's 'Owners ship better work than renters' wasn't just rhetoric this month.",
    selectedByUserId: "u_jamar",
    selectedAt: "2026-06-01T10:00:00Z",
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
