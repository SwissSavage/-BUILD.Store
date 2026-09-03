/**
 * Live chat, in Postgres.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * Every thread and every message lived in a module-level array in
 * `lib/mock-data/chat.ts`. Reader and writer both pointed at it, so it
 * was self-consistent inside one process and looked completely fine in
 * local testing. Two things it was not:
 *
 * 1. **Durable.** Every conversation was lost on deploy or container
 *    restart. During onboarding week that is somebody typing a
 *    question into the widget on Tuesday and it not existing on
 *    Wednesday.
 *
 * 2. **Shared.** The app runs multiple replicas under Swarm. A
 *    visitor's message lands in the array on replica A; the admin
 *    queue is served by replica B and never sees it. Nobody gets an
 *    error. The visitor watches an unanswered message and concludes
 *    the cooperative ignored them. We do not know the replica count
 *    yet, which is question 2 in Bayu's handoff, so we cannot even say
 *    how often this happens.
 *
 * The tables already existed and so did the readers. Only the writes
 * were missing, which is the same shape as every other instance of
 * this bug in the codebase, except here the reader was on the fixture
 * too, so nothing looked wrong from the inside.
 *
 * These are plain async functions rather than server actions on
 * purpose: the API routes under /api/chat call them directly, and a
 * "use server" module may only export async functions, which would
 * make the shared helpers below illegal to export.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { chatMessages, chatThreads } from "@/db/schema";
import type { ChatMessage, ChatThread, ChatThreadStatus } from "@/lib/types";

/**
 * Open threads first, newest message at the top, then closed ones the
 * same way. Ordering happens in SQL rather than in the admin page, so
 * the queue posture does not depend on which surface is rendering it.
 */
export async function listThreads(): Promise<ChatThread[]> {
  return db
    .select()
    .from(chatThreads)
    .orderBy(
      // "open" sorts before "closed" alphabetically, which is the
      // order we want, but relying on that would be a trap for
      // whoever adds a third status. Be explicit.
      sql`case when ${chatThreads.status} = 'open' then 0 else 1 end`,
      sql`${chatThreads.lastMessageAt} desc`,
    );
}

export async function getThreadById(id: string): Promise<ChatThread | null> {
  const [row] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.id, id))
    .limit(1);
  return row ?? null;
}

export async function getThreadByVisitorToken(
  token: string,
): Promise<ChatThread | null> {
  const [row] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.visitorToken, token))
    .limit(1);
  return row ?? null;
}

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(chatMessages.createdAt);
}

/**
 * Open threads with something the admin has not read.
 *
 * Counted in SQL. The array version loaded every thread to filter it,
 * and this number is rendered on the admin nav badge on every page,
 * which makes it the single most frequently evaluated query in the
 * admin surface.
 */
export async function unreadByAdminCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.status, "open"),
        or(
          isNull(chatThreads.adminLastReadAt),
          lt(chatThreads.adminLastReadAt, chatThreads.lastMessageAt),
        ),
      ),
    );
  return row?.n ?? 0;
}

export async function createThread(input: {
  visitorName: string;
  visitorEmail: string;
}): Promise<{ thread: ChatThread; visitorToken: string }> {
  const visitorToken = randomUUID();
  const now = new Date().toISOString();

  const [thread] = await db
    .insert(chatThreads)
    .values({
      id: `ct_${randomUUID()}`,
      visitorToken,
      visitorName: input.visitorName,
      visitorEmail: input.visitorEmail,
      status: "open",
      assignedAdminId: null,
      adminNote: null,
      createdAt: now,
      lastMessageAt: now,
      adminLastReadAt: null,
      visitorLastReadAt: now,
    })
    .returning();

  return { thread, visitorToken };
}

/**
 * Append a message and move the thread along with it.
 *
 * Both writes go in one transaction. Half of this landing means either
 * a message nobody can find because the thread never surfaced in the
 * queue, or a thread that claims recent activity with nothing in it.
 *
 * A new message from either side reopens a closed thread, which is the
 * behaviour the array version had and the right one: a visitor
 * replying to a resolved conversation is not resolved.
 */
export async function appendMessage(input: {
  threadId: string;
  sender: "visitor" | "admin";
  senderId: string | null;
  body: string;
}): Promise<{ message: ChatMessage; thread: ChatThread } | null> {
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: chatThreads.id, assignedAdminId: chatThreads.assignedAdminId })
      .from(chatThreads)
      .where(eq(chatThreads.id, input.threadId))
      .limit(1);

    if (!existing) return null;

    const [message] = await tx
      .insert(chatMessages)
      .values({
        id: `cm_${randomUUID()}`,
        threadId: input.threadId,
        sender: input.sender,
        senderId: input.senderId,
        body: input.body,
        createdAt: now,
      })
      .returning();

    const [thread] = await tx
      .update(chatThreads)
      .set({
        lastMessageAt: now,
        status: "open",
        ...(input.sender === "visitor"
          ? { visitorLastReadAt: now }
          : {
              adminLastReadAt: now,
              // First admin to reply picks up the thread. Does not
              // steal an already-assigned one.
              ...(existing.assignedAdminId || !input.senderId
                ? {}
                : { assignedAdminId: input.senderId }),
            }),
      })
      .where(eq(chatThreads.id, input.threadId))
      .returning();

    return { message, thread };
  });
}

export async function setThreadStatus(
  threadId: string,
  status: ChatThreadStatus,
  adminId: string,
): Promise<ChatThread | null> {
  const [existing] = await db
    .select({ assignedAdminId: chatThreads.assignedAdminId })
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId))
    .limit(1);

  if (!existing) return null;

  const [thread] = await db
    .update(chatThreads)
    .set({
      status,
      ...(existing.assignedAdminId ? {} : { assignedAdminId: adminId }),
    })
    .where(eq(chatThreads.id, threadId))
    .returning();

  return thread ?? null;
}

export async function markAdminRead(
  threadId: string,
): Promise<ChatThread | null> {
  const [thread] = await db
    .update(chatThreads)
    .set({ adminLastReadAt: new Date().toISOString() })
    .where(eq(chatThreads.id, threadId))
    .returning();
  return thread ?? null;
}

export async function markVisitorRead(
  visitorToken: string,
): Promise<ChatThread | null> {
  const [thread] = await db
    .update(chatThreads)
    .set({ visitorLastReadAt: new Date().toISOString() })
    .where(eq(chatThreads.visitorToken, visitorToken))
    .returning();
  return thread ?? null;
}
