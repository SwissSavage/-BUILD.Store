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
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MOCK_FUTURE_MODERNIST_RECOGNITIONS,
  periodKeyFor,
  recognitionForPeriod,
} from "@/lib/mock-data/future-modernist-recognitions";
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
  const target = MOCK_USERS.find((u) => u.id === userId);
  if (!target) throw new Error("Target user not found.");

  const date = dateStr ? new Date(dateStr) : new Date();
  const { key, label } = periodKeyFor(date, periodKind);

  if (recognitionForPeriod(key, periodKind)) {
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
  MOCK_FUTURE_MODERNIST_RECOGNITIONS.push(row);

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
  await requireAdmin();
  const recognitionId = String(formData.get("recognitionId") ?? "").trim();
  if (!recognitionId) throw new Error("recognitionId is required.");
  const idx = MOCK_FUTURE_MODERNIST_RECOGNITIONS.findIndex(
    (r) => r.id === recognitionId,
  );
  if (idx < 0) throw new Error("Recognition not found.");
  const userId = MOCK_FUTURE_MODERNIST_RECOGNITIONS[idx].userId;
  MOCK_FUTURE_MODERNIST_RECOGNITIONS.splice(idx, 1);

  const target = MOCK_USERS.find((u) => u.id === userId);
  revalidatePath("/admin/mvp");
  revalidatePath("/admin/mvp/recognition");
  if (target) revalidatePath(`/u/${target.handle}`);
}
