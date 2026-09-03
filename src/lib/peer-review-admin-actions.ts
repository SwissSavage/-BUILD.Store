/**
 * Void a peer review, and put one back.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * Peer reviews were write-once. `submitPeerReview` inserted, and
 * nothing in the codebase ever updated or deleted a row. That would be
 * defensible for an immutable record, except these are not inert: they
 * run through `recomputeMvpScore`, which sets OVR, which sets the
 * standing band, the trading card tier, and promotion eligibility.
 *
 * So one contributor could move another's standing, permanently, and
 * there was no way to correct it. Worse, no surface rendered peer
 * reviews to an admin at all. The comment at the top of
 * peer-review-actions.ts says attribution is rendered on
 * /admin/feedback; that page reads `feedback_entries`, which is beta
 * product feedback, a different table entirely. So a bad-faith review
 * was not merely irreversible, it was invisible.
 *
 * That sits badly against the rule that members keep their tier until
 * the community removes them. A single reviewer is not the community.
 *
 * WHAT THIS IS NOT: an edit. An admin cannot change what a reviewer
 * said or how they scored it. The only moves are void and restore,
 * both of which require a written reason and both of which are audit
 * logged with the reviewer, the reviewee and the scores intact. An
 * admin who could rewrite a rating could rewrite standing, and
 * standing is the thing the whole MVP rail exists to make legible.
 *
 * The row survives a void. A reviewer whose reviews keep getting
 * voided is a pattern worth seeing, and deleting the rows deletes the
 * pattern.
 *
 * KNOWN LIMITATION, stated rather than hidden: the unique index from
 * migration 0014 is on (contextKind, contextId, reviewerId,
 * revieweeId) and does not know about voiding. So a voided review
 * still occupies that slot, and the reviewer cannot submit a corrected
 * one for the same teammate on the same engagement. Voiding a review
 * removes it; it does not reopen the review. If a reviewer needs to
 * redo one, restore it and have them live with it, or accept that the
 * engagement carries one fewer review. A partial unique index would
 * fix this and is a follow-on, not something to slip into a change
 * that already touches money paths.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { peerReviews } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { recomputeMvpScore } from "@/lib/writers/mvp-score";

/**
 * Take a review out of every aggregate.
 *
 * Guarded UPDATE with `WHERE voided_at IS NULL` plus `.returning()`
 * rather than a read-then-write, so a double submit voids once and the
 * second call reports that there was nothing to do. Read-then-write on
 * this path would fire two audit entries and two recomputes for one
 * decision.
 */
export async function voidPeerReview(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Review id is required.");

  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) {
    throw new Error(
      "Say why, in at least a sentence. This is the record of why someone's standing changed.",
    );
  }

  const voided = await db
    .update(peerReviews)
    .set({
      voidedAt: new Date().toISOString(),
      voidedBy: admin.id,
      voidReason: reason,
    })
    .where(and(eq(peerReviews.id, id), isNull(peerReviews.voidedAt)))
    .returning({
      id: peerReviews.id,
      reviewerId: peerReviews.reviewerId,
      revieweeId: peerReviews.revieweeId,
      stars: peerReviews.stars,
      contextId: peerReviews.contextId,
    });

  if (voided.length === 0) {
    throw new Error("That review does not exist, or is already voided.");
  }

  const row = voided[0];

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "peer_review.voided",
    resourceKind: "user",
    resourceId: row.revieweeId,
    before: { reviewId: row.id, stars: row.stars, voided: false },
    after: { reviewId: row.id, stars: row.stars, voided: true },
    reason,
  });

  // Standing has to move with the void, in the same request. Leaving
  // the snapshot stale means the review is gone from the rating the
  // member sees while still holding down the OVR that decides their
  // card tier.
  await recomputeMvpScore(row.revieweeId);

  revalidatePath("/admin/peer-reviews");
  revalidatePath(`/admin/members/${row.revieweeId}`);
  revalidatePath("/roster");
}

/** Put a voided review back into the aggregates. */
export async function restorePeerReview(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Review id is required.");

  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) {
    throw new Error("Say why this review is being reinstated.");
  }

  const restored = await db
    .update(peerReviews)
    .set({ voidedAt: null, voidedBy: null, voidReason: null })
    .where(and(eq(peerReviews.id, id), isNotNull(peerReviews.voidedAt)))
    .returning({
      id: peerReviews.id,
      revieweeId: peerReviews.revieweeId,
      stars: peerReviews.stars,
    });

  if (restored.length === 0) {
    throw new Error("That review does not exist, or is not voided.");
  }

  const row = restored[0];

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "peer_review.restored",
    resourceKind: "user",
    resourceId: row.revieweeId,
    before: { reviewId: row.id, stars: row.stars, voided: true },
    after: { reviewId: row.id, stars: row.stars, voided: false },
    reason,
  });

  await recomputeMvpScore(row.revieweeId);

  revalidatePath("/admin/peer-reviews");
  revalidatePath(`/admin/members/${row.revieweeId}`);
  revalidatePath("/roster");
}
