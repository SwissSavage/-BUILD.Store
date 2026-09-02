"use server";

/**
 * Server actions for the walkthrough + feedback surfaces.
 *
 * Sandbox: mutates the in-memory MOCK_WALKTHROUGH_PROGRESS / MOCK_FEEDBACK
 * arrays. The mutations don't survive a server restart — that's fine for
 * the beta-prep demo.
 *
 * REPLACE WITH: Drizzle inserts into `walkthrough_progress` /
 * `feedback_entries` tables. The action signatures stay the same so
 * components don't have to change.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { feedbackEntries, walkthroughProgress } from "@/db/schema";
import type { FeedbackSentiment } from "@/lib/types";

const VALID_SENTIMENTS: FeedbackSentiment[] = [
  "positive",
  "confused",
  "blocker",
];

/**
 * Marks a walkthrough step complete for the signed-in user. Idempotent —
 * if already complete, no-op. After writing, revalidates the walkthrough
 * page so the next render shows the checkmark and resumes at the next
 * incomplete step.
 */
export async function completeWalkthroughStep(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const stepId = String(formData.get("stepId") ?? "");
  if (!stepId) return;

  // ─────────────────────────────────────────────────────────────
  // WHY THIS IS A DB WRITE NOW (2026-09-02)
  //
  // Progress was pushed onto an in-memory array, so a member ticked
  // their way through onboarding, came back after the next deploy, and
  // found every step unchecked. During onboarding week, with people
  // being walked through the product, that is the worst possible thing
  // to forget.
  //
  // ON CONFLICT DO NOTHING rather than a read-then-write: two rapid
  // submits, or a double-click on a step, should not race into two
  // rows for the same step.
  // ─────────────────────────────────────────────────────────────
  await db
    .insert(walkthroughProgress)
    .values({
      id: `wpr_${randomUUID()}`,
      userId: user.id,
      stepId,
      completedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();

  revalidatePath("/walkthrough");
  revalidatePath("/dashboard");
}

/**
 * Records a feedback entry. Used by:
 *   - the inline mini-form on each walkthrough step
 *   - the contextual `<FeedbackPrompt>` component on member surfaces
 *
 * Required form fields: surface, surfaceLabel, sentiment, note.
 * Optional: walkthroughStepId.
 *
 * Pillar + tier are pulled from the user at submit time and frozen on
 * the row so admin slice-and-dice survives later profile edits.
 */
export async function submitFeedback(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const surface = String(formData.get("surface") ?? "").trim();
  const surfaceLabel = String(formData.get("surfaceLabel") ?? "").trim();
  const sentimentRaw = String(formData.get("sentiment") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const walkthroughStepId =
    String(formData.get("walkthroughStepId") ?? "").trim() || null;

  if (
    !surface ||
    !surfaceLabel ||
    !VALID_SENTIMENTS.includes(sentimentRaw as FeedbackSentiment) ||
    !note
  ) {
    // Soft-fail in the sandbox — a real impl would surface an error
    // back to the form via a useFormState hook.
    return;
  }

  // Feedback was going to an in-memory array too, so what members
  // said about the product survived until the next restart and no
  // further. Jamar: "the feedback is already good" — none of it was
  // being kept.
  await db.insert(feedbackEntries).values({
    id: `fbk_${randomUUID()}`,
    userId: user.id,
    surface,
    surfaceLabel,
    walkthroughStepId,
    sentiment: sentimentRaw as FeedbackSentiment,
    note,
    pillar: user.primaryIndustry,
    tier: user.membershipTier,
    status: "new",
    adminNote: null,
    triagedBy: null,
    triagedAt: null,
    createdAt: new Date().toISOString(),
  });

  // Refresh the surface they came from + the walkthrough page if they
  // submitted from a step.
  revalidatePath(surface);
  revalidatePath("/walkthrough");
  revalidatePath("/admin/feedback");
}

/**
 * Admin-only: triage a feedback entry. Sets status to triaged or
 * resolved, attaches an admin note, and stamps the triaged-by/at fields.
 * No-op if the caller isn't admin (defensive against hand-crafted POST).
 */
export async function triageFeedback(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;

  if (status !== "new" && status !== "triaged" && status !== "resolved") return;

  // Was mutating the fixture object in place, so an admin triaged a
  // piece of feedback, saw it move, and found it back in "new" after
  // the next restart. Guarded on id and reports nothing found rather
  // than pretending it worked.
  const updated = await db
    .update(feedbackEntries)
    .set({
      status,
      adminNote,
      triagedBy: user.id,
      triagedAt: new Date().toISOString(),
    })
    .where(eq(feedbackEntries.id, id))
    .returning({ id: feedbackEntries.id });

  if (updated.length === 0) {
    console.error(`FEEDBACK_TRIAGE_NOT_FOUND id=${id}`);
    return;
  }

  revalidatePath("/admin/feedback");
}
