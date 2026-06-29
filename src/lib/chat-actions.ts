"use server";

/**
 * Chat server actions — visitor↔admin live chat.
 *
 * Visitor side: starting a thread sets a cookie keyed to the visitor
 * token. Subsequent visitor messages re-identify via that cookie.
 *
 * Admin side: replies + close/reopen require the current user to be
 * admin (`requireAdmin()` from auth-stub).
 *
 * Every write that flips visible state ALSO emits a chat event so the
 * SSE handlers can push to subscribed clients.
 *
 * REPLACE WITH:
 *   - Drizzle-backed reads/writes (currently in-memory mocks)
 *   - HubSpot writebacks on thread creation (TODO inline below) so
 *     warm leads also land in CRM via the existing `/api/crm` path
 *   - Postgres LISTEN/NOTIFY in place of the in-process EventEmitter
 *   - Rate limiting + spam triage on the visitor send path
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth-stub";
import { emitChatEvent } from "@/lib/chat-events";
import {
  appendMessage,
  createThread,
  getThreadById,
  getThreadByVisitorToken,
  markAdminRead,
  markVisitorRead,
  setThreadStatus,
} from "@/lib/mock-data/chat";

const VISITOR_COOKIE = "chat_visitor_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function trim(input: FormDataEntryValue | null): string {
  return typeof input === "string" ? input.trim() : "";
}

export type StartThreadResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

export async function startVisitorThread(
  formData: FormData,
): Promise<StartThreadResult> {
  const visitorName = trim(formData.get("visitorName"));
  const visitorEmail = trim(formData.get("visitorEmail"));
  const firstMessage = trim(formData.get("firstMessage"));

  if (!visitorName) return { ok: false, error: "Please share your name." };
  if (!visitorEmail || !visitorEmail.includes("@")) {
    return { ok: false, error: "An email helps us follow up." };
  }
  if (!firstMessage) return { ok: false, error: "Add a first message." };
  if (firstMessage.length > 4000) {
    return { ok: false, error: "That's a long one — keep it under 4000 chars." };
  }

  const { thread, visitorToken } = createThread({ visitorName, visitorEmail });
  const result = appendMessage({
    threadId: thread.id,
    sender: "visitor",
    senderId: null,
    body: firstMessage,
  });
  if (!result) return { ok: false, error: "Could not save the message." };

  // Persist the visitor token so the same browser re-identifies.
  // httpOnly = false because the SSE subscription URL needs to read it.
  // Sandbox-only — production should sign the cookie or move to a
  // session-cookie + server-side lookup pattern.
  const jar = await cookies();
  jar.set(VISITOR_COOKIE, visitorToken, {
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });

  // TODO (production swap, see launch-prep §6): POST to `/api/crm` so the
  // new lead also lands in HubSpot as a contact + deal. Keep in sync with
  // the existing contact-form pattern.

  emitChatEvent({ kind: "thread.created", thread: result.thread });
  emitChatEvent({
    kind: "message.created",
    message: result.message,
    thread: result.thread,
  });

  return { ok: true, threadId: thread.id };
}

export type VisitorSendResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendVisitorMessage(
  formData: FormData,
): Promise<VisitorSendResult> {
  const body = trim(formData.get("body"));
  if (!body) return { ok: false, error: "Empty message." };
  if (body.length > 4000) {
    return { ok: false, error: "Keep it under 4000 chars." };
  }
  const jar = await cookies();
  const token = jar.get(VISITOR_COOKIE)?.value;
  if (!token) return { ok: false, error: "Session expired — refresh." };

  const thread = getThreadByVisitorToken(token);
  if (!thread) return { ok: false, error: "Thread not found." };

  const result = appendMessage({
    threadId: thread.id,
    sender: "visitor",
    senderId: null,
    body,
  });
  if (!result) return { ok: false, error: "Could not save the message." };

  emitChatEvent({
    kind: "message.created",
    message: result.message,
    thread: result.thread,
  });
  emitChatEvent({ kind: "thread.updated", thread: result.thread });
  return { ok: true };
}

export async function markVisitorThreadRead(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(VISITOR_COOKIE)?.value;
  if (!token) return;
  const thread = markVisitorRead(token);
  if (thread) emitChatEvent({ kind: "thread.updated", thread });
}

// ── Admin side ──────────────────────────────────────────────────────

export async function sendAdminReply(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const threadId = trim(formData.get("threadId"));
  const body = trim(formData.get("body"));
  if (!threadId || !body) return;

  const thread = getThreadById(threadId);
  if (!thread) return;

  const result = appendMessage({
    threadId,
    sender: "admin",
    senderId: admin.id,
    body,
  });
  if (!result) return;

  emitChatEvent({
    kind: "message.created",
    message: result.message,
    thread: result.thread,
  });
  emitChatEvent({ kind: "thread.updated", thread: result.thread });
  revalidatePath("/admin/chat");
}

export async function closeChatThread(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const threadId = trim(formData.get("threadId"));
  if (!threadId) return;
  const thread = setThreadStatus(threadId, "closed", admin.id);
  if (thread) emitChatEvent({ kind: "thread.updated", thread });
  revalidatePath("/admin/chat");
}

export async function reopenChatThread(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const threadId = trim(formData.get("threadId"));
  if (!threadId) return;
  const thread = setThreadStatus(threadId, "open", admin.id);
  if (thread) emitChatEvent({ kind: "thread.updated", thread });
  revalidatePath("/admin/chat");
}

export async function markAdminThreadRead(threadId: string): Promise<void> {
  await requireAdmin();
  const thread = markAdminRead(threadId);
  if (thread) emitChatEvent({ kind: "thread.updated", thread });
}
