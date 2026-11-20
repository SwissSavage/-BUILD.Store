"use server";

/**
 * Swap one Builder for another on a draft quote (#281).
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS NOT "REMOVE, THEN ADD" (2026-11-20)
 *
 * #207 gave the composer a way to put a named Builder on an RFP who
 * never applied. #281 is the other half, split out of it: changing
 * your mind about somebody already on a draft.
 *
 * Doing that as a delete followed by an insert loses the two things
 * that make it reviewable later. The audit log would carry an
 * unexplained removal and an unrelated addition, minutes apart, with
 * nothing tying them together or saying why. And the person dropped
 * would find out from silence, which is the worst way to find out
 * that your name came off a client quote.
 *
 * One action, one audit entry naming both people and the reason, one
 * notification to the person who came off.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY DRAFT ONLY
 *
 * Once a quote is sent, proposedBuilders is what a client was shown.
 * Changing it afterwards would make the record disagree with the
 * document, which is the exact failure drizzle/0036 introduced
 * versioning to prevent: "the revision overwrites the thing that was
 * approved... attached to a row that no longer says what the client
 * saw."
 *
 * After send, the honest move is a new version, not an edit. This
 * refuses rather than quietly doing the wrong thing.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THE REPLACED PERSON'S APPLICATION ROW SURVIVES
 *
 * They did apply. That is a true fact about this project and it is
 * what the pick list, the one-bid-per-person rule and their own
 * history all read from. Coming off a draft quote is an admin
 * changing their mind about the composition, not the member
 * withdrawing, and deleting the row would rewrite it as the latter.
 *
 * It also means they can be put back without re-applying.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THE INCOMING TERMS ARE TYPED, NOT DERIVED
 *
 * A ProposedBuilder needs a timeline, a relevance line and pricing.
 * Relevance is admin-authored by definition, "why this person for
 * this project", so there is nothing to derive it from. Carrying the
 * outgoing Builder's line across would be worse than blank: it would
 * put one person's justification under another person's name on a
 * document that goes to a client.
 *
 * So the replacement is priced and described deliberately, the same
 * way the composer does it for any other Builder.
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { cooperativeQuotes, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { pushNotification } from "@/lib/milestone-core";
import { publicName, type ProposedBuilder } from "@/lib/types";

export interface ReplaceBuilderResult {
  ok: boolean;
  message: string;
}

async function nameOf(userId: string): Promise<string> {
  const [u] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      handle: users.handle,
      displayName: users.displayName,
      profileMode: users.profileMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ? publicName(u) : userId;
}

export async function replaceQuoteBuilder(
  formData: FormData,
): Promise<ReplaceBuilderResult> {
  // Inlined rather than wrapped: check-server-action-auth matches the
  // auth call inside each exported function body.
  const admin = await requireAdmin();

  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const outgoingUserId = String(formData.get("outgoingUserId") ?? "").trim();
  const incomingUserId = String(formData.get("incomingUserId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const relevance = String(formData.get("relevance") ?? "").trim();

  if (!quoteId || !outgoingUserId || !incomingUserId) {
    return { ok: false, message: "Missing quote or Builder." };
  }
  if (outgoingUserId === incomingUserId) {
    return { ok: false, message: "That is the same person." };
  }

  // A swap on a client-facing document needs a stated reason. The
  // audit entry is the only place anyone can later ask why the hand
  // changed, and "no reason given" is not an answer worth storing.
  if (reason.length < 10) {
    return {
      ok: false,
      message:
        "Say why you are swapping them. One honest sentence; it goes in the audit log, not to the client.",
    };
  }
  if (timeline.length < 3) {
    return { ok: false, message: "The replacement needs a timeline." };
  }
  if (relevance.length < 10) {
    return {
      ok: false,
      message:
        "Write the relevance line for the person coming on. It goes to the client under their name.",
    };
  }

  const [quote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.id, quoteId))
    .limit(1);
  if (!quote) return { ok: false, message: "Quote not found." };

  if (quote.status !== "draft") {
    return {
      ok: false,
      message:
        "This quote has already gone out. The client saw this hand, so it cannot be edited — issue a new version instead.",
    };
  }

  const builders = (quote.proposedBuilders as ProposedBuilder[]) ?? [];
  const at = builders.findIndex((b) => b.userId === outgoingUserId);
  if (at === -1) {
    return { ok: false, message: "That Builder is not on this quote." };
  }
  if (builders.some((b) => b.userId === incomingUserId)) {
    return {
      ok: false,
      message:
        "They are already on this quote. Each Builder appears at most once.",
    };
  }

  const [incoming] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, incomingUserId))
    .limit(1);
  if (!incoming) {
    return { ok: false, message: "That account does not exist." };
  }

  const outgoing = builders[at];

  // Position preserved. The order of a hand is a curatorial choice,
  // and appending the replacement would quietly reorder the document.
  const next = [...builders];
  next[at] = {
    userId: incomingUserId,
    // Pricing carries over from the slot, not the person. A swap
    // mid-composition is usually like-for-like on the same budget
    // line, and the composer's own per-Builder editor is where a
    // different number gets set deliberately.
    pricing: outgoing.pricing,
    ...(outgoing.clientPricing
      ? { clientPricing: outgoing.clientPricing }
      : {}),
    timeline,
    relevance,
  };

  await db
    .update(cooperativeQuotes)
    .set({ proposedBuilders: next })
    .where(eq(cooperativeQuotes.id, quoteId));

  const outName = await nameOf(outgoingUserId);
  const inName = await nameOf(incomingUserId);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.builder_replaced",
    resourceKind: "config",
    resourceId: `quote:${quoteId}`,
    before: { userId: outgoingUserId, name: outName },
    after: { userId: incomingUserId, name: inName },
    reason: `${outName} replaced by ${inName} on the draft quote. ${reason}`,
  });

  // Told, not left to notice. Their name was on a document headed for
  // a client and now is not, and the admin's reason is deliberately
  // NOT forwarded: it is written for the audit log, where it can be
  // frank, and a frank internal note is not always a kind message.
  await pushNotification({
    userId: outgoingUserId,
    kind: "rfp_status",
    title: "You have come off a draft quote",
    body: `The hand for this engagement changed while it was still in draft, so your line is no longer on it. Your application is untouched. Ask ${publicName(admin)} if you want the detail.`,
    href: `/projects/${quote.projectId}`,
  });

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/admin/contracts/${quote.projectId}`);

  return {
    ok: true,
    message: `${inName} replaces ${outName}. ${outName} has been told and their application is intact.`,
  };
}
