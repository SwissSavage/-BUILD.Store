/**
 * Inbound submission triage actions.
 *
 * Sandbox: mutate the in-memory store. Production swap: Drizzle updates
 * on `inbound_submissions` plus an `inbound_submission_events` audit
 * row per action so the queue history is reconstructible.
 *
 * Triage transitions allowed:
 *   new          → in_triage | needs_info | converted | closed_no_action
 *   in_triage    → needs_info | converted | closed_no_action | new
 *   needs_info   → in_triage | converted | closed_no_action
 *   converted    → in_triage          (rare, lets admin undo)
 *   closed_no_action → new            (rare, re-open)
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_INBOUND_SUBMISSIONS,
  findInboundSubmission,
} from "@/lib/mock-data/inbound-submissions";
import type { InboundSubmissionStatus } from "@/lib/types";

const ALLOWED_STATUSES = new Set<InboundSubmissionStatus>([
  "new",
  "in_triage",
  "needs_info",
  "converted",
  "closed_no_action",
]);

function coerceStatus(raw: FormDataEntryValue | null): InboundSubmissionStatus | null {
  const v = String(raw ?? "") as InboundSubmissionStatus;
  return ALLOWED_STATUSES.has(v) ? v : null;
}

export async function setInboundStatus(formData: FormData) {
  const admin = await requireAdmin();
  void admin;
  const id = String(formData.get("id") ?? "");
  const status = coerceStatus(formData.get("status"));
  if (!status) throw new Error("Invalid status");
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  row.status = status;
  row.updatedAt = new Date().toISOString();
  revalidatePath("/admin/inbound");
}

export async function assignInbound(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const target = String(formData.get("assigneeUserId") ?? "").trim();
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  row.assignedAdminId = target || admin.id;
  row.updatedAt = new Date().toISOString();
  revalidatePath("/admin/inbound");
}

export async function unassignInbound(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  row.assignedAdminId = null;
  row.updatedAt = new Date().toISOString();
  revalidatePath("/admin/inbound");
}

export async function setInboundTriageNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("triageNote") ?? "").trim();
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  row.triageNote = note.length === 0 ? null : note;
  row.updatedAt = new Date().toISOString();
  revalidatePath("/admin/inbound");
}

/**
 * Add tags retroactively (admin recognizing the submission is really
 * about something the original tags didn't capture). Feeds back into
 * the talent-match scorer so subsequent admin views surface better
 * suggestions.
 */
export async function appendInboundKeywordTags(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const tagsRaw = String(formData.get("tags") ?? "");
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  const additions = tagsRaw
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const next = new Set([...row.keywordTags, ...additions]);
  row.keywordTags = Array.from(next).slice(0, 50);
  row.updatedAt = new Date().toISOString();
  revalidatePath("/admin/inbound");
}

void MOCK_INBOUND_SUBMISSIONS; // keep linter happy if mutations move via helpers later
