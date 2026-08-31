/**
 * Task #64 — public community chat actions.
 *
 * Two writer actions (post, delete) plus admin moderation. Reader
 * lives inline on the /community page. Rules:
 *   - READ: anyone (visitor + member).
 *   - POST: Partner or Member tier only. Viewers get the "sign up
 *     for full posting" nudge.
 *   - DELETE: post author OR admin. Soft-delete via deleted_at so
 *     moderation stays auditable (recoverable in production; sandbox
 *     never surfaces deleted rows).
 *   - Every post runs through the PII scrubber (task #39). We store
 *     BOTH the raw body and the scrubbed body — display renders the
 *     scrubbed version; admin can see hits to nudge the poster if
 *     PII slipped through.
 *   - Rate limit: 30s between posts per user. Cheap check against
 *     the poster's most recent message.
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { communityMessages } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { scrubForClient } from "@/lib/pii-scrub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

const MAX_BODY_CHARS = 1000;
const POST_COOLDOWN_MS = 30 * 1000;

function newMessageId(): string {
  return `cmsg_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export async function postCommunityMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Sign in required to post.");
  }
  if (user.membershipTier !== "partner" && user.membershipTier !== "member") {
    throw new Error(
      "Only Partners and Members can post. Sign up for the whitelist to unlock posting.",
    );
  }

  const bodyRaw = String(formData.get("body") ?? "").trim();
  if (bodyRaw.length < 2) {
    throw new Error("Message is too short.");
  }
  if (bodyRaw.length > MAX_BODY_CHARS) {
    throw new Error(
      `Message is too long — max ${MAX_BODY_CHARS} characters.`,
    );
  }

  // Rate limit — cheap check against the poster's freshest message.
  const [recent] = await db
    .select({ createdAt: communityMessages.createdAt })
    .from(communityMessages)
    .where(
      and(
        eq(communityMessages.userId, user.id),
        isNull(communityMessages.deletedAt),
      ),
    )
    .orderBy(desc(communityMessages.createdAt))
    .limit(1);
  if (recent?.createdAt) {
    const since = Date.now() - new Date(recent.createdAt).getTime();
    if (since < POST_COOLDOWN_MS) {
      const wait = Math.ceil((POST_COOLDOWN_MS - since) / 1000);
      throw new Error(
        `Hold on ${wait}s before posting again — cooperative-chat cooldown.`,
      );
    }
  }

  const scrub = scrubForClient(bodyRaw);
  const now = new Date().toISOString();

  await db.insert(communityMessages).values({
    id: newMessageId(),
    userId: user.id,
    parentMessageId: null,
    body: bodyRaw,
    scrubbedBody: scrub.scrubbed,
    piiHits: scrub.hits,
    deletedAt: null,
    deletedByUserId: null,
    deletionReason: null,
    createdAt: now,
  });

  revalidatePath("/community");
}

export async function deleteCommunityMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");

  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!id) throw new Error("Message id required.");

  const [row] = await db
    .select()
    .from(communityMessages)
    .where(eq(communityMessages.id, id))
    .limit(1);
  if (!row) throw new Error("Message not found.");
  if (row.deletedAt) return; // already deleted, idempotent no-op

  const isAdminActor = user.isAdmin === true;
  const isAuthor = row.userId === user.id;
  if (!isAdminActor && !isAuthor) {
    throw new Error("Only the author or an admin can delete this message.");
  }

  const now = new Date().toISOString();
  await db
    .update(communityMessages)
    .set({
      deletedAt: now,
      deletedByUserId: user.id,
      deletionReason: reason,
    })
    .where(eq(communityMessages.id, id));

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: isAdminActor ? "config.setting_changed" : "user.applied",
    resourceKind: "config",
    resourceId: `community_message:${id}`,
    before: { deletedAt: null, deletedByUserId: null },
    after: {
      deletedAt: now,
      deletedByUserId: user.id,
      deletionReason: reason,
      moderator: isAdminActor,
      authorSelfDelete: isAuthor && !isAdminActor,
    },
    reason: reason ?? "Community message deleted.",
  });

  revalidatePath("/community");
}

/** Admin-only: bring a soft-deleted message back. */
export async function restoreCommunityMessage(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Message id required.");

  await db
    .update(communityMessages)
    .set({
      deletedAt: null,
      deletedByUserId: null,
      deletionReason: null,
    })
    .where(eq(communityMessages.id, id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: `community_message:${id}`,
    before: { deletedAt: "(some timestamp)" },
    after: { deletedAt: null, restored: true },
    reason: "Admin restored community message.",
  });

  revalidatePath("/community");
}
