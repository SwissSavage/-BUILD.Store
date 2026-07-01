/**
 * Data subject rights server actions — SOC 2 P5.1 / GDPR Art. 15 + 17
 * / CCPA §1798.100 + 1798.105 sandbox stub.
 *
 * Sandbox behavior: log the request against the audit log so the
 * platform has a durable record of the ask. Production replaces with:
 *   - Export: build a signed download URL to a JSON extract of the
 *     user's records across every domain table, expiring in 24 hours,
 *     delivered by email.
 *   - Erasure: enter a 30-day soft-delete window (account
 *     de-provisioned, records tombstoned on aggregate joins), then
 *     hard-delete on day 31. Financial subset (contracts, comp
 *     structure, wallet ledger) retained per legal-hold policy with
 *     a `data.record_hard_deleted` audit entry stamped at hard-delete.
 *
 * We surface the request landing to admins via notifications so a human
 * follows up — the sandbox stub doesn't itself extract or delete data.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { Notification } from "@/lib/types";

function newNotificationId(kind: string): string {
  return `ntf_${kind}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function pushAdminNotification(
  title: string,
  body: string,
  href: string,
): void {
  for (const admin of MOCK_USERS.filter((u) => u.isAdmin)) {
    const ntf: Notification = {
      id: newNotificationId("data_rights"),
      userId: admin.id,
      kind: "direct_message",
      title,
      body,
      href,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    MOCK_NOTIFICATIONS.push(ntf);
  }
}

export async function requestDataExport(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const note = String(formData.get("note") ?? "").trim();

  logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "data.subject_export_requested",
    resourceKind: "user",
    resourceId: user.id,
    before: null,
    after: { requestedAt: new Date().toISOString() },
    reason: note.length > 0 ? note.slice(0, 400) : null,
  });

  pushAdminNotification(
    `Data export requested: ${user.firstName ?? user.handle}`,
    `A Member has requested a copy of their data. Production auto-fulfills within 24 hours; sandbox surfaces the request for manual follow-up.${note ? ` Note: ${note.slice(0, 200)}` : ""}`,
    "/admin/audit-log?action=data.subject_export_requested",
  );

  revalidatePath("/profile/data-rights");
  revalidatePath("/notifications");
}

export async function requestDataErasure(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (confirmation !== "ERASE MY ACCOUNT") {
    throw new Error(
      'Type "ERASE MY ACCOUNT" exactly to confirm. Erasure is a two-step ask by design — we do not want to lose a Member to a mis-click.',
    );
  }

  logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "data.subject_erasure_requested",
    resourceKind: "user",
    resourceId: user.id,
    before: null,
    after: {
      requestedAt: new Date().toISOString(),
      softDeleteAt: new Date().toISOString(),
      hardDeleteAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    reason: reason.length > 0 ? reason.slice(0, 400) : null,
  });

  pushAdminNotification(
    `Erasure requested: ${user.firstName ?? user.handle}`,
    `A Member has requested account erasure. Production begins the 30-day soft-delete window and hard-deletes on day 31 (financial subset retained per legal hold). Sandbox surfaces the request for manual follow-up.${reason ? ` Reason: ${reason.slice(0, 200)}` : ""}`,
    "/admin/audit-log?action=data.subject_erasure_requested",
  );

  revalidatePath("/profile/data-rights");
  revalidatePath("/notifications");
}
