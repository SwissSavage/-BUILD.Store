/**
 * Rater chase workflow — reminder dispatch for missing ratings.
 *
 * When a contract closes and admin wants to trigger graduated
 * bonus release, three ratings need to be on file: PM (admin),
 * peer (per contributor), and client. When any of them isn't
 * captured yet, admin can fire a targeted reminder from
 * /admin/reserve to nudge the specific rater. Reminders are
 * lightweight — an in-app notification for peers/PM, a fresh
 * magic-link email (or the intent thereof, MVP) for the client.
 *
 * Sandbox: writes to MOCK_NOTIFICATIONS + audit log. Production
 * dispatches real email through Postmark and the notification
 * inserter goes to the notifications table.
 *
 * All three reminder actions live in one module so the reserve
 * surface can import them together.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { Notification } from "@/lib/types";

function nextNotifId(prefix: string): string {
  return `ntf_${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function pushNotification(input: {
  userId: string;
  kind: Notification["kind"];
  title: string;
  body: string;
  href: string;
}): Notification {
  const notif: Notification = {
    id: nextNotifId("chase"),
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  MOCK_NOTIFICATIONS.push(notif);
  return notif;
}

/**
 * Nudge the PM to capture their engagement rating on the settle
 * page. Fires an in-app notification to every admin on the
 * project's roster (PM identity isn't a discrete role — any admin
 * with the deal in their queue can fill it).
 */
export async function remindPmForRating(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Project id required.");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  const targets = project.adminUserIds.length > 0 ? project.adminUserIds : [];
  if (targets.length === 0) {
    throw new Error(
      "No admin roster on this project. Assign at least one admin before nudging.",
    );
  }

  for (const targetId of targets) {
    pushNotification({
      userId: targetId,
      kind: "contract_stage",
      title: `PM engagement rating needed — ${project.title}`,
      body: `Graduated bonus release is waiting on your PM rating. Capture it on the settle page.`,
      href: `/admin/contracts/${projectId}/settle`,
    });
  }

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "reserve.credited", // reuse until chase.reminder verb added
    resourceKind: "reserve_pool",
    resourceId: projectId,
    before: null,
    after: {
      kind: "chase_pm_rating",
      recipients: targets.length,
      project: project.title,
    },
    reason: `Chase reminder: ${targets.length} admin(s) nudged to capture PM engagement rating.`,
  });

  revalidatePath(`/admin/reserve`);
}

/**
 * Nudge fellow contributors on the project to submit peer reviews
 * for the target contributor. Fires an in-app notification to every
 * OTHER assigned member on the project (peers are the group; the
 * target contributor doesn't get pinged to review themselves).
 */
export async function remindPeersForRating(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const targetContributorId = String(
    formData.get("contributorId") ?? "",
  ).trim();
  if (!projectId) throw new Error("Project id required.");
  if (!targetContributorId) throw new Error("Contributor id required.");

  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");
  const targetUser = MOCK_USERS.find((u) => u.id === targetContributorId);
  const targetName = targetUser
    ? `${targetUser.firstName} ${targetUser.lastName ?? ""}`.trim()
    : targetContributorId;

  const peers = project.assignedMemberIds.filter(
    (id) => id !== targetContributorId,
  );
  if (peers.length === 0) {
    throw new Error(
      `${targetName} is the only assigned member. No peers to nudge.`,
    );
  }

  for (const peerId of peers) {
    pushNotification({
      userId: peerId,
      kind: "peer_review_requested",
      title: `Peer review needed for ${targetName}`,
      body: `Their bonus release is waiting on your review. Head to the project page to leave one.`,
      href: `/projects/${projectId}`,
    });
  }

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "reserve.credited",
    resourceKind: "reserve_pool",
    resourceId: projectId,
    before: null,
    after: {
      kind: "chase_peer_reviews",
      target: targetContributorId,
      recipients: peers.length,
    },
    reason: `Chase reminder: ${peers.length} peer(s) nudged to review ${targetName}.`,
  });

  revalidatePath(`/admin/reserve`);
}

/**
 * (Re-)send the client the magic-link to submit feedback. MVP logs
 * the intent + drops an audit trail row; production dispatches a
 * real email via Postmark. Client email captured from the
 * client-facing invoice recipient / project client contact when
 * one is on file.
 */
export async function remindClientForFeedback(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const clientEmail = String(formData.get("clientEmail") ?? "").trim();
  if (!projectId) throw new Error("Project id required.");
  if (!clientEmail) {
    throw new Error(
      "Client email required — the magic-link needs a destination.",
    );
  }
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  // Sandbox: just log the intent. Production wires the actual
  // Postmark dispatch + regenerates a fresh single-use token
  // pointing at /contracts/[id]/feedback?token=<token>.
  // eslint-disable-next-line no-console
  console.log(
    `[chase] client-feedback magic-link intent: /contracts/${projectId}/feedback → ${clientEmail}`,
  );

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "reserve.credited",
    resourceKind: "reserve_pool",
    resourceId: projectId,
    before: null,
    after: {
      kind: "chase_client_feedback",
      clientEmail,
      project: project.title,
    },
    reason: `Chase reminder: client-feedback magic-link fired to ${clientEmail}.`,
  });

  revalidatePath(`/admin/reserve`);
}
