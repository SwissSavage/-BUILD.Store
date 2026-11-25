"use server";

/**
 * Record which way a shortfall went, and bench somebody if that is the
 * way it went.
 *
 * ─────────────────────────────────────────────────────────────
 * NOTHING HERE MOVES MONEY (2026-11-25)
 *
 * Jamar: "Disposition is a direction, not an action. The payouts
 * should stop where they landed if the project is over."
 *
 * I had reconcileBonusMargin returning three ordered recommendations
 * and assumed the next thing to build was a surface that spends the
 * uncommitted balance — a redistribution engine with a coverage
 * ledger behind it. That was wrong twice over: the payouts have
 * already happened, and the balance simply stops.
 *
 * So this writes a direction and, on a replacement, a bench record. No
 * transfers, no splits, no vouchers. The money that moved, moved when
 * the margin was reconciled.
 *
 * ─────────────────────────────────────────────────────────────
 * A REBATE ENDS DISTRIBUTION
 *
 * "if there's a rebate that gets logged nothing else is distributed."
 *
 * So the direction is exclusive. Choosing rebate is choosing not to
 * replace, and the record says so rather than leaving both open.
 *
 * ─────────────────────────────────────────────────────────────
 * A REPLACEMENT'S TERMS ARE OPEN, INCLUDING WHERE THE MONEY COMES FROM
 *
 * "The rate for the replacement is TBD and in essence treated like a
 * new contract." And: "we might be paying the replacement wholly, or
 * partially from the remaining pool, we're not going to go in
 * assuming anything."
 *
 * So this sets nothing about the incoming person: not their rate, not
 * their split, and NOT whether the uncommitted balance funds them.
 * That balance may cover all of it, some of it, or none of it, and
 * which one is a decision taken when their terms are composed with a
 * real number in front of somebody.
 *
 * Two assumptions avoided here, and I had made the second one. The
 * first is deriving their rate from the outgoing person's. The second
 * is my own earlier conclusion that a replacement is funded entirely
 * outside the pool — stated as though it were settled, when nobody
 * had decided it.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { engagementBenchings, projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export interface DispositionResult {
  ok: boolean;
  message: string;
}

export type DispositionKind = "stop" | "rebate" | "replace";

/** Shortest reason that carries anything. Same bar as a review. */
const REASON_MIN = 12;

export async function setDisposition(
  formData: FormData,
): Promise<DispositionResult> {
  // Inlined: check-server-action-auth wants the gate in the body.
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (!user.isAdmin) {
    return { ok: false, message: "Only a member admin sets a disposition." };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const benchUserId = String(formData.get("benchUserId") ?? "").trim();
  const replacedByUserId = String(
    formData.get("replacedByUserId") ?? "",
  ).trim();

  if (!projectId) return { ok: false, message: "Missing engagement." };
  if (kindRaw !== "stop" && kindRaw !== "rebate" && kindRaw !== "replace") {
    return { ok: false, message: "Pick a direction." };
  }
  const kind: DispositionKind = kindRaw;

  // Required on every direction. Each one of these follows somebody —
  // a rebate follows the engagement into the client relationship, a
  // bench follows a person into their grading, and "stop" is a
  // decision to absorb a shortfall that somebody should be able to
  // account for later.
  if (reason.length < REASON_MIN) {
    return {
      ok: false,
      message:
        "Say why in a line. This is read later by somebody deciding whether it was fair.",
    };
  }

  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
      assigned: projects.assignedMemberIds,
      existing: projects.dispositionKind,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, message: "Engagement not found." };

  // A direction is set once. Changing it after the fact would rewrite
  // what the record says happened, and the bench attached to it
  // already counts against somebody.
  if (project.existing) {
    return {
      ok: false,
      message: `This engagement already went to "${project.existing}". That is the record.`,
    };
  }

  const assigned = project.assigned ?? [];

  if (kind === "replace") {
    if (!benchUserId) {
      return { ok: false, message: "Say who is coming off the engagement." };
    }
    if (!assigned.includes(benchUserId)) {
      return { ok: false, message: "That person is not on this engagement." };
    }
    if (replacedByUserId && replacedByUserId === benchUserId) {
      return { ok: false, message: "They cannot replace themselves." };
    }

    await db.insert(engagementBenchings).values({
      id: `bch_${randomUUID()}`,
      projectId,
      userId: benchUserId,
      replacedByUserId: replacedByUserId || null,
      reason,
      benchedByUserId: user.id,
    });

    // Deliberately NOT removing them from assignedMemberIds. The bench
    // is the record that they were on it and came off; deleting them
    // would make the contract read as though they never were, detach
    // their reviews, and hand the grading a clean slate.
    //
    // The replacement is added, because they ARE on it now and their
    // own terms get composed separately.
    if (replacedByUserId && !assigned.includes(replacedByUserId)) {
      await db
        .update(projects)
        .set({
          assignedMemberIds: [...assigned, replacedByUserId],
          updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, projectId));
    }
  }

  const now = new Date().toISOString();
  await db
    .update(projects)
    .set({
      dispositionKind: kind,
      dispositionReason: reason,
      dispositionByUserId: user.id,
      dispositionAt: now,
      updatedAt: now,
    })
    .where(eq(projects.id, projectId));

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "contract.disposition_set",
    resourceKind: "project",
    resourceId: projectId,
    after: {
      disposition: kind,
      benchedUserId: kind === "replace" ? benchUserId : null,
      replacedByUserId: kind === "replace" ? replacedByUserId || null : null,
    },
    reason,
  });

  revalidatePath(`/admin/contracts/${projectId}/reviews`);
  revalidatePath(`/admin/contracts/${projectId}`);

  return {
    ok: true,
    message:
      kind === "replace"
        ? "Recorded. Compose the replacement's terms separately — the rate is agreed, and whether the uncommitted balance covers any of it is part of that conversation."
        : kind === "rebate"
          ? "Recorded. Nothing further is distributed; the concession moves through the usual payment rail."
          : "Recorded. The payouts stand as they landed.",
  };
}
