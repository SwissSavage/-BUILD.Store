"use server";

/**
 * Configure a review round, then open it for everybody at once.
 *
 * ─────────────────────────────────────────────────────────────
 * NOTHING IS REVIEWED UNTIL THIS SAYS SO (2026-11-25)
 *
 * Jamar: "If I'm not configuring a review to reach the customer and
 * related parties there shouldn't be any reviewing happening at all",
 * and no reviewing "until everyone has the review link/page."
 *
 * What was built before this: review forms rendered on the deal page
 * the moment a contract hit completed. No configuration, no send, and
 * nothing making the evaluations simultaneous. One Builder could be
 * rated on Monday by whoever opened the deal and on Friday by someone
 * else, against roles that changed in between — and roles decide
 * which questions are asked while slots decide whose answer counts.
 * The blend that comes out of that decides money.
 *
 * So: draft, open, closed. Opening is the single deliberate act, and
 * it is not complete until the last person holds the link.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  clients as clientsTable,
  engagementReviewRecipients,
  engagementReviewRounds,
  projects,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";
import { getEngagementRoles, getReviewSlots, safely } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { sendTransactionalEmail } from "@/lib/email";
import { publicName } from "@/lib/types";

export interface RoundResult {
  ok: boolean;
  message: string;
}

/** Create the draft if there isn't one, so configuring has somewhere to live. */
export async function ensureReviewRound(
  formData: FormData,
): Promise<RoundResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (!user.isAdmin) {
    return { ok: false, message: "Only a member admin opens a review round." };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return { ok: false, message: "Missing engagement." };

  const [existing] = await db
    .select({ id: engagementReviewRounds.id })
    .from(engagementReviewRounds)
    .where(eq(engagementReviewRounds.projectId, projectId))
    .limit(1);
  if (existing) return { ok: true, message: "Draft already open." };

  await db.insert(engagementReviewRounds).values({
    id: `rnd_${randomUUID()}`,
    projectId,
    status: "draft",
  });
  revalidatePath(`/admin/contracts/${projectId}/reviews`);
  return { ok: true, message: "Draft started. Configure, then open it." };
}

/**
 * Open the round: freeze the configuration, write a recipient row per
 * person who must be reached, and send to all of them in one pass.
 *
 * Opening is irreversible by design. The configuration is frozen here
 * so a later edit cannot retroactively change what somebody was asked
 * or how much their answer counted — otherwise an admin could open a
 * round, watch an unflattering rating land, and move the rater out of
 * the peer slot.
 */
export async function openReviewRound(
  formData: FormData,
): Promise<RoundResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (!user.isAdmin) {
    return { ok: false, message: "Only a member admin opens a review round." };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return { ok: false, message: "Missing engagement." };

  const [project] = await db
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      assigned: projects.assignedMemberIds,
      admins: projects.adminUserIds,
      clientRefId: projects.clientRefId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, message: "Engagement not found." };
  if (project.status !== "completed") {
    return {
      ok: false,
      message: "Open the round once the engagement is marked complete.",
    };
  }

  const [round] = await db
    .select()
    .from(engagementReviewRounds)
    .where(eq(engagementReviewRounds.projectId, projectId))
    .limit(1);
  if (!round) return { ok: false, message: "Start a draft first." };
  if (round.status !== "draft") {
    return { ok: false, message: `This round is already ${round.status}.` };
  }

  // ── Freeze what it runs under ───────────────────────────────
  const roles = await safely(
    () => getEngagementRoles(projectId),
    new Map<string, string[]>(),
  );
  const slots = await safely(
    () => getReviewSlots(projectId),
    new Map<string, "peer" | "pm">(),
  );

  const memberIds = [
    ...new Set([...(project.assigned ?? []), ...(project.admins ?? [])]),
  ];
  if (memberIds.length === 0) {
    return { ok: false, message: "Nobody is on this engagement." };
  }

  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });
  const byId = new Map(roster.map((u) => [u.id, u]));

  // ── Who must be reached ─────────────────────────────────────
  //
  // Members and the client together, because "everyone involved
  // should be getting signaled to leave a review at the same time."
  const targets: {
    userId: string | null;
    email: string;
    kind: "member" | "client";
    name: string;
  }[] = [];

  for (const id of memberIds) {
    const u = byId.get(id);
    const email = u?.email?.trim();
    if (!email) continue;
    targets.push({
      userId: id,
      email,
      kind: "member",
      name: u ? publicName(u) : "there",
    });
  }

  if (project.clientRefId) {
    const [client] = await db
      .select({
        email: clientsTable.primaryContactEmail,
        hubspotCompanyId: clientsTable.hubspotCompanyId,
      })
      .from(clientsTable)
      .where(eq(clientsTable.id, project.clientRefId))
      .limit(1);

    const clientEmails = new Set<string>();
    if (client?.hubspotCompanyId) {
      try {
        const { contactEmailsForCompany } = await import("@/lib/crm-stub");
        for (const e of await contactEmailsForCompany(client.hubspotCompanyId)) {
          clientEmails.add(e);
        }
      } catch {
        // HubSpot being unreachable must not stop the round. The
        // local contact below carries it, and a missing recipient
        // shows as undelivered rather than vanishing.
      }
    }
    const local = client?.email?.trim().toLowerCase();
    if (local) clientEmails.add(local);
    for (const email of clientEmails) {
      targets.push({ userId: null, email, kind: "client", name: "there" });
    }
  }

  if (targets.length === 0) {
    return {
      ok: false,
      message:
        "Nobody has an address on file, so opening the round would signal no one.",
    };
  }

  const now = new Date().toISOString();
  await db
    .update(engagementReviewRounds)
    .set({
      status: "open",
      configuration: {
        roles: Object.fromEntries(roles),
        slots: Object.fromEntries(slots),
      },
      openedByUserId: user.id,
      openedAt: now,
    })
    .where(eq(engagementReviewRounds.id, round.id));

  // ── Signal everyone, in one pass ────────────────────────────
  //
  // Each send records its own outcome. Reviewing stays shut until
  // every row is delivered, so a failure here is visible and
  // chaseable rather than a person quietly never being asked.
  const origin = (
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ""
  ).replace(/\/$/, "");

  for (const t of targets) {
    const id = `rcp_${randomUUID()}`;
    const url =
      t.kind === "member"
        ? `${origin}/projects/${projectId}/reviews`
        : `${origin}/contracts/${projectId}/feedback`;
    let status: "delivered" | "failed" = "delivered";
    let error: string | null = null;
    try {
      await sendTransactionalEmail({
        to: t.email,
        subject: `How did ${project.title} go?`,
        text:
          `${project.title} is wrapped, and everyone involved is being asked at the same time.\n\n` +
          `${url}\n\n` +
          `Scores are visible to the person rated. Who said what is not.`,
      });
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }
    await db.insert(engagementReviewRecipients).values({
      id,
      roundId: round.id,
      userId: t.userId,
      email: t.email,
      kind: t.kind,
      deliveryStatus: status,
      deliveryError: error,
      deliveredAt: status === "delivered" ? new Date().toISOString() : null,
    });
  }

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "contract.review_round_opened",
    resourceKind: "project",
    resourceId: projectId,
    after: { recipients: targets.length },
    reason: "Review round opened; everyone signalled together.",
  });

  revalidatePath(`/admin/contracts/${projectId}/reviews`);
  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    message: `Opened. ${targets.length} people signalled. Reviewing stays shut until every one of them has it.`,
  };
}

/**
 * Record that somebody was reached another way.
 *
 * A client address that bounces forever would otherwise freeze a
 * round permanently. This takes a name and a reason, because it is a
 * statement that somebody has the link — and without it the honest
 * move would be to lie to the system.
 */
export async function markReachedManually(
  formData: FormData,
): Promise<RoundResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (!user.isAdmin) return { ok: false, message: "Admins only." };

  const recipientId = String(formData.get("recipientId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!recipientId) return { ok: false, message: "Missing recipient." };
  if (reason.length < 12) {
    return {
      ok: false,
      message: "Say how they got it. This is a statement that they have it.",
    };
  }

  await db
    .update(engagementReviewRecipients)
    .set({
      deliveryStatus: "delivered",
      deliveredAt: new Date().toISOString(),
      reachedManuallyByUserId: user.id,
      reachedManuallyReason: reason,
    })
    .where(eq(engagementReviewRecipients.id, recipientId));

  return { ok: true, message: "Recorded." };
}
