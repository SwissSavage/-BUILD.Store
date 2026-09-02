/**
 * Walkthrough progress for a member.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Both halves were on the fixture. completeWalkthroughStep pushed onto
 * MOCK_WALKTHROUGH_PROGRESS and completedStepIds read the same array,
 * which is why nobody noticed: within one container's lifetime it
 * behaved correctly, and every restart silently reset everyone's
 * onboarding to zero.
 *
 * That symmetry is also why the writer could not be moved on its own.
 * Writing to Postgres while still reading the fixture would have made
 * it worse than before: the tick would have stopped appearing at all,
 * rather than appearing and later vanishing.
 *
 * The step definitions stay in mock-data. Those are content, not
 * state, and there is no table for them.
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { walkthroughProgress } from "@/db/schema";

/** Step ids this member has completed. */
export async function getCompletedStepIds(
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ stepId: walkthroughProgress.stepId })
    .from(walkthroughProgress)
    .where(eq(walkthroughProgress.userId, userId));
  return new Set(rows.map((r) => r.stepId));
}
