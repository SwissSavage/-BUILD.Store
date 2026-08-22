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
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_INBOUND_SUBMISSIONS,
  findInboundSubmission,
} from "@/lib/mock-data/inbound-submissions";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
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
  const id = String(formData.get("id") ?? "");
  const status = coerceStatus(formData.get("status"));
  if (!status) throw new Error("Invalid status");
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  const previous = row.status;
  row.status = status;
  row.updatedAt = new Date().toISOString();

  // Audit — for the RFP intake kind, "converted" ≈ approved and
  // "closed_no_action" ≈ rejected. Emit the specific rfp verb so
  // compliance surfaces can distinguish. Other kinds fall back to a
  // config verb since inbound triage isn't itself security-material.
  if (row.kind === "rfp_intake") {
    if (status === "converted" && previous !== "converted") {
      logAuditEvent({
        actorUserId: admin.id,
        actorRoleSnapshot: snapshotActorRole(admin),
        action: "rfp.approved",
        resourceKind: "project",
        resourceId: row.linkedResourceId ?? row.id,
        before: { status: previous },
        after: { status },
      });
    } else if (
      status === "closed_no_action" &&
      previous !== "closed_no_action"
    ) {
      logAuditEvent({
        actorUserId: admin.id,
        actorRoleSnapshot: snapshotActorRole(admin),
        action: "rfp.rejected",
        resourceKind: "project",
        resourceId: row.linkedResourceId ?? row.id,
        before: { status: previous },
        after: { status },
      });
    }
  }

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

/**
 * Promote a join_talent_signup inbound submission to Track A invite
 * generation. Marks the submission in_triage (admin is now working
 * it) and redirects to /admin/members/invite with the applicant's
 * email + name + a summary note prefilled. Admin picks the tier,
 * reviews the prefill, hits generate — the existing countersign-
 * first invite ceremony takes over from there (task #26). Once
 * consumed, admin flips the source submission to "converted"
 * manually to close the loop.
 *
 * Task #43 external-application track: this is the on-platform
 * bridge from public /signup/join intake to the internal Track A
 * invite flow.
 */
export async function promoteInboundToInvite(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  if (row.kind !== "join_talent_signup") {
    throw new Error(
      "Promote-to-invite is only for join_talent_signup submissions.",
    );
  }
  if (!row.submitterEmail) {
    throw new Error(
      "Cannot promote: this submission has no submitter email.",
    );
  }

  // Flip to in_triage if still new so the queue reflects that admin
  // has actually picked it up. Leave existing in_triage/needs_info
  // states alone.
  if (row.status === "new") {
    const previous = row.status;
    row.status = "in_triage";
    row.updatedAt = new Date().toISOString();
    logAuditEvent({
      actorUserId: admin.id,
      actorRoleSnapshot: snapshotActorRole(admin),
      action: "inbound.promoted_to_invite",
      resourceKind: "config",
      resourceId: `inbound:${row.id}`,
      before: { status: previous },
      after: { status: row.status, reason: "promoted_to_invite" },
    });
  }

  // Compose a note that carries the applicant's own pitch through
  // to the audit log on the invite — makes the "why we invited"
  // trail visible without a click-through.
  const noteBody = row.body ? row.body.slice(0, 300) : "";
  const note = noteBody
    ? `Promoted from inbound ${row.id}. Applicant pitch: ${noteBody}`
    : `Promoted from inbound ${row.id}.`;

  const qs = new URLSearchParams({
    email: row.submitterEmail,
    name: row.submitter ?? "",
    note,
    fromInboundId: row.id,
  });

  revalidatePath("/admin/inbound");
  redirect(`/admin/members/invite?${qs.toString()}`);
}

/**
 * Accept a proposed-but-unvetted skill tag from an inbound submission.
 * Promotes the tag from `proposedKeywordTags` into canonical
 * `keywordTags` so the auto-matcher can start using it. Task #43.
 *
 * When we ship the `canonical_skill_tags` corpus (task #43 follow-up),
 * this action should also insert the accepted tag into that corpus so
 * subsequent /signup/join forms can suggest it in typeahead. For now
 * it just promotes on this row and audit-logs.
 */
export async function acceptProposedInboundTag(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!tag) throw new Error("Missing tag");
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  const proposed = row.proposedKeywordTags ?? [];
  if (!proposed.includes(tag)) {
    // Idempotent: silently succeed if the tag was already handled.
    revalidatePath("/admin/inbound");
    return;
  }
  row.proposedKeywordTags = proposed.filter((t) => t !== tag);
  const nextCanonical = new Set([...row.keywordTags, tag]);
  row.keywordTags = Array.from(nextCanonical).slice(0, 50);
  row.updatedAt = new Date().toISOString();

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "inbound.tag_accepted",
    resourceKind: "config",
    resourceId: `inbound:${row.id}`,
    before: null,
    after: { tag },
  });

  revalidatePath("/admin/inbound");
}

/**
 * Reject a proposed skill tag. Drops it from `proposedKeywordTags`
 * without promoting. Audit-logged so the "why we don't use this
 * label" trail is queryable later. Task #43.
 */
export async function rejectProposedInboundTag(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!tag) throw new Error("Missing tag");
  const row = findInboundSubmission(id);
  if (!row) throw new Error("Submission not found");
  const proposed = row.proposedKeywordTags ?? [];
  if (!proposed.includes(tag)) {
    revalidatePath("/admin/inbound");
    return;
  }
  row.proposedKeywordTags = proposed.filter((t) => t !== tag);
  row.updatedAt = new Date().toISOString();

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "inbound.tag_rejected",
    resourceKind: "config",
    resourceId: `inbound:${row.id}`,
    before: null,
    after: { tag },
  });

  revalidatePath("/admin/inbound");
}

void MOCK_INBOUND_SUBMISSIONS; // keep linter happy if mutations move via helpers later
