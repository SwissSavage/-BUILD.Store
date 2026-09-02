/**
 * Triage updates for a stored inbound submission.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Every triage action mutated a fixture object in place: set status,
 * assign, unassign, note, tags. Within one container that looked like
 * it worked and reverted on the next restart. Once the queue was moved
 * to read Postgres, those mutations stopped being visible at all.
 *
 * DERIVED ROWS ARE NOT EDITABLE. The queue composes stored submissions
 * with rows derived from RFPs, chat threads, applications and quote
 * sheets, which have synthetic ids and no row of their own. Mutating
 * one previously changed a transient object and appeared to succeed.
 * Now it says so, because "I triaged it and it didn't stick" is a much
 * worse experience than "this one is managed where it came from".
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inboundSubmissions } from "@/db/schema";
import type { InboundSubmission } from "@/lib/types";

/** Derived ids are namespaced by origin; stored ones are not. */
const DERIVED_PREFIXES = ["in_rfp_", "in_chat_", "in_app_", "in_quote_"];

export function isDerivedSubmission(id: string): boolean {
  return DERIVED_PREFIXES.some((p) => id.startsWith(p));
}

/** Load a stored submission, or null if it is derived or absent. */
export async function getStoredSubmission(
  id: string,
): Promise<InboundSubmission | null> {
  if (isDerivedSubmission(id)) return null;
  const [row] = await db
    .select()
    .from(inboundSubmissions)
    .where(eq(inboundSubmissions.id, id))
    .limit(1);
  return (row as unknown as InboundSubmission) ?? null;
}

type Patch = Partial<
  Pick<
    InboundSubmission,
    | "status"
    | "assignedAdminId"
    | "triageNote"
    | "keywordTags"
    | "pillarTags"
    | "proposedKeywordTags"
    | "linkedResourceId"
  >
>;

/**
 * Apply a triage patch. Throws with a readable reason rather than
 * silently doing nothing, since every caller is an admin action whose
 * whole purpose is to change something.
 */
export async function updateInboundSubmission(
  id: string,
  patch: Patch,
): Promise<void> {
  if (isDerivedSubmission(id)) {
    throw new Error(
      "This entry is derived from an RFP, chat or application and cannot be triaged here. Manage it where it came from.",
    );
  }

  const updated = await db
    .update(inboundSubmissions)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(inboundSubmissions.id, id))
    .returning({ id: inboundSubmissions.id });

  if (updated.length === 0) throw new Error("Submission not found.");
}
