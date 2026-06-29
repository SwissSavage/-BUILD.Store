/**
 * Mock chat storage — visitor↔admin live chat.
 *
 * Module-level mutable state. Survives across requests within one Node
 * process (dev server) but resets on process restart, like the rest of
 * the sandbox mocks. Pinned to `globalThis` so Next.js's hot reload
 * doesn't re-seed the store every time a chat file is edited.
 *
 * REPLACE WITH: Drizzle queries against `chat_threads` + `chat_messages`
 * tables. Schema mirrors these interfaces 1:1.
 */
import { randomUUID } from "node:crypto";
import type { ChatMessage, ChatThread, ChatThreadStatus } from "@/lib/types";

interface ChatStore {
  threads: ChatThread[];
  messages: ChatMessage[];
}

const KEY = "__build_store_chat_store__";

type GlobalWithStore = typeof globalThis & {
  [KEY]?: ChatStore;
};

function getStore(): ChatStore {
  const g = globalThis as GlobalWithStore;
  if (!g[KEY]) {
    g[KEY] = seed();
  }
  return g[KEY]!;
}

function seed(): ChatStore {
  const threads: ChatThread[] = [
    {
      id: "ct_001",
      visitorToken: "demo-visitor-token-001",
      visitorName: "Maya Lin",
      visitorEmail: "maya@example.com",
      status: "open",
      assignedAdminId: null,
      adminNote: null,
      createdAt: "2026-04-29T15:42:00Z",
      lastMessageAt: "2026-04-29T15:51:30Z",
      adminLastReadAt: null,
      visitorLastReadAt: "2026-04-29T15:42:00Z",
    },
    {
      id: "ct_002",
      visitorToken: "demo-visitor-token-002",
      visitorName: "Daniel Park",
      visitorEmail: "daniel@example.com",
      status: "closed",
      assignedAdminId: "u_jamar",
      adminNote: "Routed to /signup; not a contract lead.",
      createdAt: "2026-04-28T11:10:00Z",
      lastMessageAt: "2026-04-28T11:24:00Z",
      adminLastReadAt: "2026-04-28T11:30:00Z",
      visitorLastReadAt: "2026-04-28T11:25:00Z",
    },
  ];
  const messages: ChatMessage[] = [
    // Thread 1 — open, awaiting admin reply.
    {
      id: "cm_001",
      threadId: "ct_001",
      sender: "visitor",
      senderId: null,
      body:
        "Hi — saw the showcase, looking for a small team to land a clinical-data dashboard in Q3. Where do I start?",
      createdAt: "2026-04-29T15:42:00Z",
    },
    {
      id: "cm_002",
      threadId: "ct_001",
      sender: "visitor",
      senderId: null,
      body: "Budget is roughly $40-60k. Timing is flexible.",
      createdAt: "2026-04-29T15:51:30Z",
    },
    // Thread 2 — closed, with admin reply.
    {
      id: "cm_003",
      threadId: "ct_002",
      sender: "visitor",
      senderId: null,
      body: "How do I sign up as talent?",
      createdAt: "2026-04-28T11:10:00Z",
    },
    {
      id: "cm_004",
      threadId: "ct_002",
      sender: "admin",
      senderId: "u_jamar",
      body:
        "Welcome — applications run through /signup/join. Two-minute form, then we review weekly. I'll personally see your file.",
      createdAt: "2026-04-28T11:18:00Z",
    },
    {
      id: "cm_005",
      threadId: "ct_002",
      sender: "visitor",
      senderId: null,
      body: "Got it, applying now. Thanks.",
      createdAt: "2026-04-28T11:24:00Z",
    },
  ];
  return { threads, messages };
}

// ── Read helpers ────────────────────────────────────────────────────

export function listThreads(): ChatThread[] {
  // Open first (newest message at top), then closed (newest message
  // at top). Matches the admin queue posture.
  const all = getStore().threads;
  const open = all
    .filter((t) => t.status === "open")
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const closed = all
    .filter((t) => t.status === "closed")
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return [...open, ...closed];
}

export function getThreadById(id: string): ChatThread | null {
  return getStore().threads.find((t) => t.id === id) ?? null;
}

export function getThreadByVisitorToken(token: string): ChatThread | null {
  return getStore().threads.find((t) => t.visitorToken === token) ?? null;
}

export function listMessages(threadId: string): ChatMessage[] {
  return getStore()
    .messages.filter((m) => m.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function unreadByAdminCount(): number {
  return getStore().threads.filter((t) => {
    if (t.status !== "open") return false;
    if (!t.adminLastReadAt) return true;
    return t.lastMessageAt > t.adminLastReadAt;
  }).length;
}

// ── Write helpers ──────────────────────────────────────────────────
//
// Server-action layer wraps these and handles event emission. Keep
// the write helpers themselves emission-free so tests can call them
// without spinning up the EventEmitter.

export function createThread(input: {
  visitorName: string;
  visitorEmail: string;
}): { thread: ChatThread; visitorToken: string } {
  const store = getStore();
  const visitorToken = randomUUID();
  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: `ct_${randomUUID().slice(0, 8)}`,
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
  };
  store.threads.push(thread);
  return { thread, visitorToken };
}

export function appendMessage(input: {
  threadId: string;
  sender: "visitor" | "admin";
  senderId: string | null;
  body: string;
}): { message: ChatMessage; thread: ChatThread } | null {
  const store = getStore();
  const thread = store.threads.find((t) => t.id === input.threadId);
  if (!thread) return null;
  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: `cm_${randomUUID().slice(0, 8)}`,
    threadId: input.threadId,
    sender: input.sender,
    senderId: input.senderId,
    body: input.body,
    createdAt: now,
  };
  store.messages.push(message);
  thread.lastMessageAt = now;
  // Re-open a closed thread when either party sends a new message.
  if (thread.status === "closed") thread.status = "open";
  if (input.sender === "visitor") {
    thread.visitorLastReadAt = now;
  } else {
    thread.adminLastReadAt = now;
    if (!thread.assignedAdminId && input.senderId) {
      thread.assignedAdminId = input.senderId;
    }
  }
  return { message, thread };
}

export function setThreadStatus(
  threadId: string,
  status: ChatThreadStatus,
  adminId: string,
): ChatThread | null {
  const store = getStore();
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread) return null;
  thread.status = status;
  if (!thread.assignedAdminId) thread.assignedAdminId = adminId;
  return thread;
}

export function markAdminRead(threadId: string): ChatThread | null {
  const store = getStore();
  const thread = store.threads.find((t) => t.id === threadId);
  if (!thread) return null;
  thread.adminLastReadAt = new Date().toISOString();
  return thread;
}

export function markVisitorRead(visitorToken: string): ChatThread | null {
  const store = getStore();
  const thread = store.threads.find((t) => t.visitorToken === visitorToken);
  if (!thread) return null;
  thread.visitorLastReadAt = new Date().toISOString();
  return thread;
}
