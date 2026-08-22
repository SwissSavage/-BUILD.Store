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
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";

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
    const already = MOCK_NOTIFICATIONS.some(
      (n) =>
        n.userId === uid &&
        n.kind === "rfp_quote_request" &&
        n.href.endsWith(`/contracts/${rfpId}?dispatch=1`) &&
        now - new Date(n.createdAt).getTime() < debounceMs,
    );
    if (already) {
      skipped += 1;
      continue;
    }

    MOCK_NOTIFICATIONS.push({
      id: `ntf_rfp_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      userId: uid,
      kind: "rfp_quote_request",
      title: `Quote request: ${rfp.title}`,
      body: `Admin routed this open contract to you. Review the brief and submit a bid if it's a fit.`,
      href: `/contracts/${rfpId}?dispatch=1`,
      createdAt: new Date().toISOString(),
      readAt: null,
    });

    logAuditEvent({
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
