/**
 * Future Modernist recognition actions.
 *
 * Selection mechanism (locked, Phase 1): admin picks a winner from the
 * metric-driven shortlist (top OVR snapshots in the period, non-
 * provisional) and writes an editorial narrative published with the
 * recognition. Phase 2 (Member-count gated) replaces admin pick with
 * Member vote; the server contract stays the same.
 *
 * Sandbox: mutate the in-memory recognition store. Production: persist
 * to `future_modernist_recognitions` with an append-only event log.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { futureModernistRecognitions } from "@/db/schema";
import { getUserById } from "@/lib/readers/users";
import { periodKeyFor } from "@/lib/recognition-period";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { FutureModernistRecognition } from "@/lib/types";

function newRecognitionId(): string {
  return `fmr_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

/**
 * Admin selects a winner for a given period. Period kind is "month" or
 * "year"; period is encoded by an ISO date string the admin picks (or
 * defaults to today). Duplicate selections for the same period are
 * blocked unless the admin explicitly chooses a different winner via
 * the override flow (delete + reselect).
 */
export async function selectFutureModernist(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const periodKind = (
    String(formData.get("periodKind") ?? "month") as "month" | "year"
  );
  const dateStr = String(formData.get("periodDate") ?? "").trim();
  const narrative = String(formData.get("narrative") ?? "").trim();

  if (!userId) throw new Error("Pick a winner from the shortlist.");
  if (!["month", "year"].includes(periodKind)) {
    throw new Error("periodKind must be 'month' or 'year'.");
  }
  if (narrative.length < 50) {
    throw new Error(
      "Narrative must be at least 50 characters — recognitions ship with editorial weight.",
    );
  }
  const target = await getUserById(userId);
  if (!target) throw new Error("Target user not found.");

  const date = dateStr ? new Date(dateStr) : new Date();
  const { key, label } = periodKeyFor(date, periodKind);

  // One recognition per period, checked against the table rather than
  // the fixture. This guard used to consult MOCK data, so it protected
  // seed rows and ignored real ones.
  const [clash] = await db
    .select({ id: futureModernistRecognitions.id })
    .from(futureModernistRecognitions)
    .where(eq(futureModernistRecognitions.periodKey, key))
    .limit(1);
  if (clash) {
    throw new Error(
      `A recognition already exists for ${label}. Rescind the existing one before selecting a new winner.`,
    );
  }

  const row: FutureModernistRecognition = {
    id: newRecognitionId(),
    userId,
    periodKind,
    periodKey: key,
    periodLabel: label,
    narrative,
    selectedByUserId: admin.id,
    selectedAt: new Date().toISOString(),
  };
  // ─────────────────────────────────────────────────────────────
  // WHY THIS IS A DB WRITE NOW (2026-09-02)
  //
  // Recognitions were pushed onto an in-memory array. /u/[handle] was
  // switched to read them from Postgres earlier today, so as of that
  // change awarding a recognition would have written to memory and
  // rendered from a table it never reached: the honour would appear
  // nowhere and disappear on restart.
  //
  // This is also an input to the discovery gate. publicProfileEligible
  // reads active recognitions to decide whether a Partner shows in
  // public surfaces, so a recognition that does not persist is a
  // permission that does not persist either.
  // ─────────────────────────────────────────────────────────────
  await db.insert(futureModernistRecognitions).values({
    id: row.id,
    userId: row.userId,
    periodKind: row.periodKind,
    periodKey: row.periodKey,
    periodLabel: row.periodLabel,
    narrative: row.narrative,
    selectedByUserId: row.selectedByUserId,
    selectedAt: row.selectedAt,
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "recognition.selected",
    resourceKind: "recognition",
    resourceId: row.id,
    before: null,
    after: {
      userId,
      periodKind,
      periodKey: key,
      periodLabel: label,
    },
    reason: narrative.slice(0, 400),
  });

  revalidatePath("/admin/mvp");
  revalidatePath("/admin/mvp/recognition");
  revalidatePath(`/u/${target.handle}`);
}

/**
 * Rescind a previously-selected recognition. Removes the row entirely;
 * production should switch this to an append-only "rescinded" status
 * for the audit trail.
 */
export async function rescindFutureModernist(formData: FormData) {
  const admin = await requireAdmin();
  const recognitionId = String(formData.get("recognitionId") ?? "").trim();
  if (!recognitionId) throw new Error("recognitionId is required.");
  const [original] = await db
    .select()
    .from(futureModernistRecognitions)
    .where(eq(futureModernistRecognitions.id, recognitionId))
    .limit(1);
  if (!original) throw new Error("Recognition not found.");
  const userId = original.userId;

  await db
    .delete(futureModernistRecognitions)
    .where(eq(futureModernistRecognitions.id, recognitionId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "recognition.revoked",
    resourceKind: "recognition",
    resourceId: recognitionId,
    before: {
      userId: original.userId,
      periodKind: original.periodKind,
      periodKey: original.periodKey,
      periodLabel: original.periodLabel,
    },
    after: null,
  });

  const target = await getUserById(userId);
  revalidatePath("/admin/mvp");
  revalidatePath("/admin/mvp/recognition");
  if (target) revalidatePath(`/u/${target.handle}`);
}
