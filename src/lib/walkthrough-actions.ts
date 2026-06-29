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
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_WALKTHROUGH_PROGRESS } from "@/lib/mock-data/walkthroughs";
import { MOCK_FEEDBACK } from "@/lib/mock-data/feedback";
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

  const already = MOCK_WALKTHROUGH_PROGRESS.some(
    (p) => p.userId === user.id && p.stepId === stepId,
  );
  if (!already) {
    MOCK_WALKTHROUGH_PROGRESS.push({
      id: `wpr_${Date.now()}`,
      userId: user.id,
      stepId,
      completedAt: new Date().toISOString(),
    });
  }

  revalidatePath("/walkthrough");
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

  MOCK_FEEDBACK.push({
    id: `fbk_${Date.now()}`,
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

  const row = MOCK_FEEDBACK.find((f) => f.id === id);
  if (!row) return;
  if (status !== "new" && status !== "triaged" && status !== "resolved") return;

  row.status = status;
  row.adminNote = adminNote;
  row.triagedBy = user.id;
  row.triagedAt = new Date().toISOString();

  revalidatePath("/admin/feedback");
}
