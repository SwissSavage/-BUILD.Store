/**
 * The recipient agrees, or says it is wrong.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-29)
 *
 * Self-billing only works if the person being paid confirms the
 * amount. Without that it is a receipt, and a receipt is the
 * cooperative asserting what it paid rather than evidence anybody
 * agreed to it. The acknowledgement is the thing an invoice was
 * standing in for.
 *
 * Disputing is deliberately as easy as accepting. A statement somebody
 * can only agree with is not evidence of agreement, and the member who
 * has just been underpaid is exactly the person least likely to push
 * if pushing requires a separate conversation with an admin.
 *
 * Neither action changes the money. Splits are written and transfers
 * are dispatched by the time a statement exists, so this records what
 * the recipient says about it and puts a dispute in front of an admin.
 * Correcting an actual error stays a deliberate act on the settlement
 * surface, with the allocator in front of you.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { remittances } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { projectAdminUserIds, fanOut } from "@/lib/milestone-core";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

async function loadOwn(remittanceId: string, userId: string) {
  const [row] = await db
    .select()
    .from(remittances)
    .where(eq(remittances.id, remittanceId))
    .limit(1);
  if (!row) throw new Error("That statement does not exist.");
  // Yours or nobody's. An admin wanting to see one looks at the
  // contract, not at somebody else's acknowledgement.
  if (row.recipientId !== userId) {
    throw new Error("That statement belongs to someone else.");
  }
  return row;
}

export async function acknowledgeRemittance(formData: FormData): Promise<void> {
  // getCurrentUser inline rather than through a helper: a module-level
  // "use server" file publishes every export as a POST endpoint, and
  // check-server-action-auth looks for the gate in each function body.
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const id = String(formData.get("remittanceId") ?? "").trim();
  const row = await loadOwn(id, user.id);
  if (row.acknowledgedAt) return;

  const now = new Date().toISOString();
  await db
    .update(remittances)
    .set({ acknowledgedAt: now, disputedAt: null, disputeNote: null })
    .where(and(eq(remittances.id, id), isNull(remittances.acknowledgedAt)));

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "remittance.acknowledged",
    resourceKind: "project",
    resourceId: row.contractId,
    before: null,
    after: { remittanceId: id, cashAmount: row.cashAmount, pool: row.pool },
    reason: `${row.recipientLabel} confirmed their statement`,
  });

  revalidatePath("/profile/payouts");
}

export async function disputeRemittance(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const id = String(formData.get("remittanceId") ?? "").trim();
  const note = String(formData.get("disputeNote") ?? "").trim();
  if (note.length < 10) {
    throw new Error(
      "Say what looks wrong. An admin reads this and needs something to act on.",
    );
  }
  const row = await loadOwn(id, user.id);

  const now = new Date().toISOString();
  await db
    .update(remittances)
    .set({ disputedAt: now, disputeNote: note, acknowledgedAt: null })
    .where(eq(remittances.id, id));

  // Straight to the people who own the deal. A dispute that sits in a
  // table until somebody happens to look is the same as no dispute.
  const admins = await projectAdminUserIds(row.contractId);
  await fanOut(admins, {
    kind: "split_distributed",
    title: `${row.recipientLabel} disputed their payout statement`,
    body: note.slice(0, 200),
    href: `/admin/contracts/${row.contractId}`,
  });

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "remittance.disputed",
    resourceKind: "project",
    resourceId: row.contractId,
    before: null,
    after: { remittanceId: id, cashAmount: row.cashAmount, note },
    reason: `${row.recipientLabel} says their statement is wrong`,
  });

  revalidatePath("/profile/payouts");
  revalidatePath(`/admin/contracts/${row.contractId}`);
}
