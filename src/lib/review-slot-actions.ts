"use server";

/**
 * Put somebody in the peer or PM slot for one engagement.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS GUARDED HARDER THAN ROLE ASSIGNMENT (2026-11-25)
 *
 * A role decides which questions get pointed at someone. A slot
 * decides how much their own opinion moves somebody else's pay: the
 * peer slot carries 0.4 of the blend, the PM slot 0.2. Moving a person
 * between them changes a payout without touching a single rating.
 *
 * So the availability rule is enforced here and not only in the UI. A
 * server action is a public endpoint, and the whole point of only
 * offering this on engagements that cannot fill their own slots is
 * lost if a posted form can do it anywhere.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { engagementReviewSlots, projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { slotAssignment, type ReviewSlot } from "@/lib/review-slots";

export interface SlotAssignResult {
  ok: boolean;
  message: string;
}

export async function setReviewSlot(
  formData: FormData,
): Promise<SlotAssignResult> {
  // Inlined: check-server-action-auth looks for the gate inside each
  // exported function body.
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (!user.isAdmin) {
    return { ok: false, message: "Only a member admin assigns review slots." };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const raw = String(formData.get("slot") ?? "").trim();
  if (!projectId || !userId) {
    return { ok: false, message: "Missing engagement or person." };
  }

  const [project] = await db
    .select({
      id: projects.id,
      assigned: projects.assignedMemberIds,
      admins: projects.adminUserIds,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, message: "Engagement not found." };

  const partyUserIds = [...new Set([...(project.assigned ?? []), ...(project.admins ?? [])])];
  if (!partyUserIds.includes(userId)) {
    return { ok: false, message: "That person was not on this engagement." };
  }

  // ── The availability rule, enforced ─────────────────────────
  //
  // One rule: a small engagement cannot fill its own slots, a larger
  // one can.
  const availability = slotAssignment({ partyUserIds });
  if (!availability.available) {
    return { ok: false, message: availability.explanation };
  }

  // Clearing is a real choice: an admin who assigned the wrong person
  // needs a way back to the natural reading.
  if (raw === "") {
    await db
      .delete(engagementReviewSlots)
      .where(
        and(
          eq(engagementReviewSlots.projectId, projectId),
          eq(engagementReviewSlots.userId, userId),
        )!,
      );
    await logAuditEvent({
      actorUserId: user.id,
      actorRoleSnapshot: snapshotActorRole(user),
      action: "contract.review_slot_set",
      resourceKind: "project",
      resourceId: projectId,
      after: { userId, slot: null },
      reason: "Cleared; the natural reading applies again.",
    });
    revalidatePath(`/admin/contracts/${projectId}/reviews`);
    return { ok: true, message: "Cleared." };
  }

  if (raw !== "peer" && raw !== "pm") {
    return { ok: false, message: "A slot is either peer or PM." };
  }
  const slot: ReviewSlot = raw;

  // One slot per person: the unique index backs this, but saying it
  // here means the second assignment replaces rather than throwing.
  await db
    .delete(engagementReviewSlots)
    .where(
      and(
        eq(engagementReviewSlots.projectId, projectId),
        eq(engagementReviewSlots.userId, userId),
      )!,
    );
  await db.insert(engagementReviewSlots).values({
    id: `ers_${randomUUID()}`,
    projectId,
    userId,
    slot,
    assignedByUserId: user.id,
  });

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "contract.review_slot_set",
    resourceKind: "project",
    resourceId: projectId,
    after: { userId, slot },
    reason: availability.explanation,
  });

  revalidatePath(`/admin/contracts/${projectId}/reviews`);
  return { ok: true, message: `Counted as ${slot === "pm" ? "PM" : "peer"}.` };
}
