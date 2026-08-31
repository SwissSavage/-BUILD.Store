"use server";

/**
 * Admin RFP dispatch — send quote-request pings to matched talent
 * (task #36). Extends the workflow doc's step 6 ("Jamar copy-pastes
 * RFP into emails, sends quote requests") into a one-click on-
 * platform action.
 *
 * MVP behavior: dispatch fires a notification per selected talent
 * with the RFP title + a direct link to the /contracts/[id] bid
 * form. Also records an audit entry per pick so the dispatch trail
 * is queryable.
 *
 * Real email sending piggybacks on the existing invite-email
 * infrastructure and lands in a follow-up — for now the notification
 * center + the bell dot are the reach mechanism, which works
 * for on-platform talent (Track A). External talent (Track B) needs
 * the email path — deferred until we wire the send template.
 */

import { revalidatePath } from "next/cache";
import { notify } from "@/lib/writers/notifications";
import { getNotificationsForUser } from "@/lib/readers/notifications";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { inviteLinks, projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

/**
 * Dispatch quote-request pings to a set of talent user ids for a
 * specific RFP-approved contract. Idempotent per (rfpId, userId):
 * re-dispatching the same pair inside a 24h window is a no-op so
 * accidental double-clicks don't double-ping.
 */
export async function dispatchRfpQuoteRequests(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const rfpId = String(formData.get("rfpId") ?? "").trim();
  const targetUserIds = formData
    .getAll("targetUserIds")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  if (!rfpId) throw new Error("rfpId is required");
  if (targetUserIds.length === 0) {
    throw new Error("Pick at least one talent to dispatch to.");
  }

  const [rfp] = await db
    .select({
      id: projects.id,
      title: projects.title,
      kind: projects.kind,
      status: projects.status,
      isRfp: projects.isRfp,
      rfpApprovedAt: projects.rfpApprovedAt,
    })
    .from(projects)
    .where(eq(projects.id, rfpId))
    .limit(1);

  if (
    !rfp ||
    rfp.kind !== "contract" ||
    !rfp.isRfp ||
    rfp.status !== "open" ||
    !rfp.rfpApprovedAt
  ) {
    throw new Error(
      "This RFP isn't open for dispatch. Approve it first at /admin/rfps.",
    );
  }

  const now = Date.now();
  const debounceMs = 24 * 60 * 60 * 1000;

  let dispatched = 0;
  let skipped = 0;

  for (const uid of new Set(targetUserIds)) {
    // Debounce — check for a recent dispatch to this user for this
    // RFP. Uses the notifications table itself; href suffix carries
    // the pair identifier.
    // Debounce against the notifications table. This read the
    // in-memory array, which reset on every deploy — so the same
    // member could be re-pinged about the same contract after each
    // one, and the debounce window silently meant nothing.
    const recent = await getNotificationsForUser(uid, 100);
    const already = recent.some(
      (n) =>
        n.kind === "rfp_quote_request" &&
        n.href.endsWith(`/contracts/${rfpId}?dispatch=1`) &&
        now - new Date(n.createdAt).getTime() < debounceMs,
    );
    if (already) {
      skipped += 1;
      continue;
    }

    // Shared writer — the in-memory push meant a routed contract
    // never reached the member it was routed to.
    await notify({
      userId: uid,
      kind: "rfp_quote_request",
      title: `Quote request: ${rfp.title}`,
      body: `Admin routed this open contract to you. Review the brief and submit a bid if it's a fit.`,
      href: `/contracts/${rfpId}?dispatch=1`,
    });

    await logAuditEvent({
      actorUserId: admin.id,
      actorRoleSnapshot: snapshotActorRole(admin),
      action: "rfp.dispatched",
      resourceKind: "project",
      resourceId: rfpId,
      before: null,
      after: { targetUserId: uid },
      reason: `Quote request dispatched to ${uid} for RFP ${rfpId}.`,
    });
    dispatched += 1;
  }

  revalidatePath(`/admin/rfps/${rfpId}/dispatch`);
  revalidatePath("/admin/rfps");

  // Return via revalidate rather than throwing on skipped duplicates
  // — admin sees the queue update on next render. If you want the
  // count surfaced, wire a session flash.
  void dispatched;
  void skipped;
}

// ────────────────────────────────────────────────────────────────
//  Task #37 — RFP → optional invite (external talent recruitment)
// ────────────────────────────────────────────────────────────────

const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function newInviteId(): string {
  return `invite_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function newInviteCode(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Recruit external talent into an RFP bid. Kicks off the existing
 * invite-link flow (Partner tier by default — external talent lands
 * as a Partner and can graduate to Member after standing up), with
 * the invite `note` field carrying the RFP context so the follow-up
 * touch has grounding.
 *
 * Deliberately minimal — does NOT auto-send the Documenso LOI at
 * generation time (unlike admin-invite ceremony via generateInviteLink)
 * because external talent may not be a fit after intake. Admin
 * follows up manually to promote qualified applicants into the full
 * countersign flow. The follow-up: generalize LOI-on-generate as a
 * checkbox so this action can opt in when the RFP fit is obvious.
 */
export async function inviteExternalTalentForRfp(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const rfpId = String(formData.get("rfpId") ?? "").trim();
  const targetEmail = String(formData.get("targetEmail") ?? "")
    .trim()
    .toLowerCase();
  const targetName = String(formData.get("targetName") ?? "").trim();
  const targetTier =
    (String(formData.get("targetTier") ?? "partner").trim() as
      | "partner"
      | "member");
  const inviteReason = String(formData.get("inviteReason") ?? "").trim();

  if (!rfpId) throw new Error("rfpId is required");
  if (!targetEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) {
    throw new Error("A valid target email is required.");
  }
  if (targetTier !== "partner" && targetTier !== "member") {
    throw new Error("Invite tier must be partner or member.");
  }

  const [rfp] = await db
    .select({
      id: projects.id,
      title: projects.title,
      kind: projects.kind,
      status: projects.status,
      isRfp: projects.isRfp,
      rfpApprovedAt: projects.rfpApprovedAt,
    })
    .from(projects)
    .where(eq(projects.id, rfpId))
    .limit(1);

  if (
    !rfp ||
    rfp.kind !== "contract" ||
    !rfp.isRfp ||
    !rfp.rfpApprovedAt
  ) {
    throw new Error(
      "This RFP isn't open for external invites. Approve it first at /admin/rfps.",
    );
  }

  const now = new Date();
  const notePrefix = `Invited to bid on RFP: ${rfp.title} (${rfp.id}).`;
  const note = inviteReason
    ? `${notePrefix} ${inviteReason}`
    : notePrefix;

  const invite = {
    id: newInviteId(),
    code: newInviteCode(),
    targetEmail,
    targetTier,
    targetName: targetName.length > 0 ? targetName : null,
    note,
    createdByUserId: admin.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS).toISOString(),
    consumedAt: null,
    consumedByUserId: null,
    revokedAt: null,
    revokedReason: null,
  };
  await db.insert(inviteLinks).values(invite);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.invited",
    resourceKind: "user",
    resourceId: invite.id,
    before: null,
    after: {
      targetEmail: invite.targetEmail,
      targetTier: invite.targetTier,
      rfpId: rfp.id,
      inviteMode: "rfp_recruit",
    },
    reason: `RFP-recruit invite for ${rfp.title}`,
  });

  revalidatePath(`/admin/rfps/${rfpId}/dispatch`);
  revalidatePath("/admin/members/invite");
}
