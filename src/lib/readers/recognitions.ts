/**
 * Recognitions and canonizations for a member's public profile.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * /u/[handle] read both from fixtures. Those two blocks are the
 * credibility of the whole page: Future Modernist recognitions and
 * canonization years are the cooperative vouching for someone, and
 * they were rendered from seed data. A real member who had earned one
 * would not see it, and seeded names carried honours that were never
 * awarded.
 *
 * That matters more than the usual reader swap because of what this
 * page is for. Jamar: "The goal is for it to be a truly bespoke
 * portfolio with ratings, feedback, real work, and real client data.
 * The marketing is them displaying it proudly." A portfolio someone
 * shares to win work cannot be showing decoration.
 * ─────────────────────────────────────────────────────────────
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { futureModernistRecognitions, memberCanonizations } from "@/db/schema";
import { periodKeyFor } from "@/lib/recognition-period";
import type { FutureModernistRecognition, MemberCanonization } from "@/lib/types";

/** Every recognition a member holds, newest period first. */
export async function getRecognitionsForUser(
  userId: string,
): Promise<FutureModernistRecognition[]> {
  const rows = await db
    .select()
    .from(futureModernistRecognitions)
    .where(eq(futureModernistRecognitions.userId, userId))
    .orderBy(desc(futureModernistRecognitions.selectedAt));
  return rows as unknown as FutureModernistRecognition[];
}

/**
 * Split a member's recognitions into the currently-open ones and the rest.
 *
 * Pure, so the page runs one query rather than two. Uses the same
 * period definition as the discovery gate — current calendar month for
 * monthly winners, current calendar year for Constellation — so
 * "shown as active on the profile" and "eligible for public discovery"
 * can never disagree.
 */
export function splitActiveRecognitions(
  rows: FutureModernistRecognition[],
  now: Date = new Date(),
): {
  month: FutureModernistRecognition | null;
  year: FutureModernistRecognition | null;
  past: FutureModernistRecognition[];
} {
  const monthKey = periodKeyFor(now, "month").key;
  const yearKey = periodKeyFor(now, "year").key;
  const month = rows.find((r) => r.periodKey === monthKey) ?? null;
  const year = rows.find((r) => r.periodKey === yearKey) ?? null;
  const past = rows.filter((r) => r.id !== month?.id && r.id !== year?.id);
  return { month, year, past };
}

/** Canonization years for a member, newest first. */
export async function getCanonizationsForUser(
  userId: string,
): Promise<MemberCanonization[]> {
  const rows = await db
    .select()
    .from(memberCanonizations)
    .where(eq(memberCanonizations.userId, userId))
    .orderBy(desc(memberCanonizations.year));
  return rows as unknown as MemberCanonization[];
}
