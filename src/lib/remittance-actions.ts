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
 *
 * ─────────────────────────────────────────────────────────────
 * TWO CONFIRMATIONS, EITHER ORDER (2026-11-19)
 *
 * Jamar: "the review process should also typically happen first, but
 * we need a flow that lands either in optional order specifically for
 * grandfather situations like this."
 *
 * There was one acknowledgeRemittance standing for two different
 * statements:
 *
 *   the figure is correct   answerable the moment the statement
 *                           exists, before any money moves
 *   the money arrived       only answerable once it has been sent
 *
 * On a normal engagement they collapse into one act, which is why the
 * single button looked right. Two cases break it.
 *
 * Grandfathered work: the money landed before the app had a statement
 * for it, so the recipient was blocked from agreeing a figure they
 * were paid for weeks ago until an admin back-filled the send record.
 *
 * Dispute after payment: being paid the wrong amount is the most
 * likely moment for a dispute, and it was inexpressible, because
 * agree and dispute wrote the same field and that field was gated on
 * payment.
 *
 * So: agreeRemittanceAmount has no payment gate, confirmReceipt does,
 * and either may land first. acknowledgedAt is not dropped; it now
 * means "both", written when the second one arrives, so existing
 * reads like getOpenRemittanceDisputes keep working.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { remittances, revenueSplits } from "@/db/schema";
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

/**
 * "The figure is correct."
 *
 * No payment gate, on purpose. A statement can be checked against the
 * rate, the attribution ledger and the milestone record the moment it
 * is issued, and whether the money has moved yet has no bearing on
 * whether the arithmetic is right.
 */
export async function agreeRemittanceAmount(
  formData: FormData,
): Promise<void> {
  // getCurrentUser inline rather than through a helper: a module-level
  // "use server" file publishes every export as a POST endpoint, and
  // check-server-action-auth looks for the gate in each function body.
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const id = String(formData.get("remittanceId") ?? "").trim();
  const row = await loadOwn(id, user.id);
  if (row.amountAgreedAt) return;

  const now = new Date().toISOString();
  await db
    .update(remittances)
    .set({
      amountAgreedAt: now,
      // Agreeing withdraws a dispute. The two are contradictory
      // claims about the same number.
      disputedAt: null,
      disputeNote: null,
      // Settled only once both halves are in.
      ...(row.receiptConfirmedAt ? { acknowledgedAt: now } : {}),
    })
    .where(and(eq(remittances.id, id), isNull(remittances.amountAgreedAt)));

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "remittance.acknowledged",
    resourceKind: "project",
    resourceId: row.contractId,
    before: null,
    after: {
      remittanceId: id,
      cashAmount: row.cashAmount,
      pool: row.pool,
      confirmed: "amount",
    },
    reason: `${row.recipientLabel} agreed the amount on their statement`,
  });

  revalidatePath("/profile/payouts");
}

/**
 * "The money arrived."
 *
 * Gated on the split actually being marked sent, because this is a
 * claim about the real world and the app has no other way to know.
 * The gate is here in the action rather than only in the UI: the old
 * ordering rule lived in a template, which is why it could not be
 * reasoned about.
 */
export async function confirmRemittanceReceipt(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const id = String(formData.get("remittanceId") ?? "").trim();
  const row = await loadOwn(id, user.id);
  if (row.receiptConfirmedAt) return;

  // The split this statement was cut from, matched on contract, pool
  // and recipient: the same key the statement was issued on.
  //
  // The two tables do NOT share a pool vocabulary. revenue_splits
  // folds treasury and the liquidity pool into one "reserve" bucket;
  // remittances names them separately, because a statement is
  // addressed to somebody and those two are addressed to house
  // sentinels. Hence the map rather than a direct comparison.
  //
  // In practice neither sentinel reaches here: loadOwn above requires
  // the signed-in user to BE the recipient, and HOUSE_TREASURY_ID and
  // HOUSE_LP_ID are not accounts anyone signs in as. The mapping is
  // for correctness of the query, not for a path a person walks.
  const SPLIT_POOL: Record<string, "contributor" | "admin" | "reserve"> = {
    contributor: "contributor",
    admin: "admin",
    treasury: "reserve",
    liquidity_pool: "reserve",
  };
  const splitPool = SPLIT_POOL[row.pool];
  if (!splitPool) {
    throw new Error("That statement has no matching payout to confirm.");
  }

  const [split] = await db
    .select({ payoutStatus: revenueSplits.payoutStatus })
    .from(revenueSplits)
    .where(
      and(
        eq(revenueSplits.recipientId, row.recipientId),
        eq(revenueSplits.pool, splitPool),
        row.contractId
          ? eq(revenueSplits.contractId, row.contractId)
          : isNull(revenueSplits.contractId),
      ),
    )
    .limit(1);

  if (split?.payoutStatus !== "sent") {
    throw new Error(
      "This one has not been sent yet. You can still confirm the amount is right in the meantime.",
    );
  }

  const now = new Date().toISOString();
  await db
    .update(remittances)
    .set({
      receiptConfirmedAt: now,
      ...(row.amountAgreedAt ? { acknowledgedAt: now } : {}),
    })
    .where(
      and(eq(remittances.id, id), isNull(remittances.receiptConfirmedAt)),
    );

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "remittance.acknowledged",
    resourceKind: "project",
    resourceId: row.contractId,
    before: null,
    after: {
      remittanceId: id,
      cashAmount: row.cashAmount,
      pool: row.pool,
      confirmed: "receipt",
    },
    reason: `${row.recipientLabel} confirmed the money arrived`,
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
    .set({
      disputedAt: now,
      disputeNote: note,
      // Clears the agreement about the FIGURE, and the combined
      // settled flag with it. receiptConfirmedAt deliberately
      // survives: "I got the money and it is the wrong amount" is a
      // real and common thing to say, and it used to be impossible
      // to express because both halves shared one column.
      amountAgreedAt: null,
      acknowledgedAt: null,
    })
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
