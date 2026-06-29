"use client";

/**
 * Admin chat board — list of threads on the left, conversation pane
 * on the right. SSE-subscribes to `/api/chat/stream/admin` and folds
 * realtime events into local state.
 *
 * Initial state comes from the server component (parent /admin/chat
 * page); this client component only manages live updates and the
 * reply form.
 *
 * Sandbox uses optimistic appends on send; SSE de-dupes by message id.
 */

import { useEffect, useRef, useState } from "react";
import {
  closeChatThread,
  markAdminThreadRead,
  reopenChatThread,
  sendAdminReply,
} from "@/lib/chat-actions";
import {
  CHAT_THREAD_STATUS_LABELS,
  type ChatMessage,
  type ChatThread,
} from "@/lib/types";

interface Props {
  adminId: string;
  initialThreads: ChatThread[];
  initialThreadId: string | null;
  initialMessages: ChatMessage[];
}

export function AdminChatBoard({
  adminId,
  initialThreads,
  initialThreadId,
  initialMessages,
}: Props) {
  const [threads, setThreads] = useState<ChatThread[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialThreadId,
  );
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, ChatMessage[]>
  >(initialThreadId ? { [initialThreadId]: initialMessages } : {});
  const [pending, setPending] = useState(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  // SSE subscription — admin sees ALL events.
  useEffect(() => {
    const es = new EventSource("/api/chat/stream/admin");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.kind === "thread.created") {
          setThreads((prev) => upsertThread(prev, event.thread));
        } else if (event.kind === "thread.updated") {
          setThreads((prev) => upsertThread(prev, event.thread));
        } else if (event.kind === "message.created") {
          setThreads((prev) => upsertThread(prev, event.thread));
          setMessagesByThread((prev) => {
            const existing = prev[event.message.threadId] ?? [];
            if (existing.some((m) => m.id === event.message.id)) return prev;
            return {
              ...prev,
              [event.message.threadId]: [...existing, event.message],
            };
          });
        }
      } catch {
        // Ignore.
      }
    };
    return () => es.close();
  }, []);

  // Lazy-load messages when the admin opens a thread we haven't seen.
  useEffect(() => {
    if (!activeThreadId) return;
    if (messagesByThread[activeThreadId]) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/admin/messages?thread=${encodeURIComponent(activeThreadId)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (cancelled) return;
        setMessagesByThread((prev) => ({
          ...prev,
          [activeThreadId]: data.messages,
        }));
      } catch {
        // Ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, messagesByThread]);

  // Mark the active thread admin-read whenever it changes or a new
  // visitor message lands in it.
  useEffect(() => {
    if (!activeThreadId) return;
    void markAdminThreadRead(activeThreadId);
  }, [activeThreadId, messagesByThread]);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = messageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messagesByThread, activeThreadId]);

  const activeThread =
    threads.find((t) => t.id === activeThreadId) ?? null;
  const activeMessages = activeThreadId
    ? (messagesByThread[activeThreadId] ?? [])
    : [];

  async function handleSend(form: HTMLFormElement) {
    if (!activeThread) return;
    setPending(true);
    try {
      const fd = new FormData(form);
      fd.set("threadId", activeThread.id);
      const body = String(fd.get("body") ?? "").trim();
      if (!body) return;
      // Optimistic append; SSE will reconcile by id.
      setMessagesByThread((prev) => {
        const optimistic: ChatMessage = {
          id: `optimistic_${Date.now()}`,
          threadId: activeThread.id,
          sender: "admin",
          senderId: adminId,
          body,
          createdAt: new Date().toISOString(),
        };
        const existing = prev[activeThread.id] ?? [];
        return { ...prev, [activeThread.id]: [...existing, optimistic] };
      });
      await sendAdminReply(fd);
      form.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[18rem_1fr]">
      {/* Thread list */}
      <aside className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]">
        <ul className="max-h-[36rem] overflow-y-auto">
          {threads.map((t) => {
            const isActive = t.id === activeThreadId;
            const isUnread =
              t.status === "open" &&
              (!t.adminLastReadAt || t.lastMessageAt > t.adminLastReadAt);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActiveThreadId(t.id)}
                  className={`flex w-full flex-col items-start gap-1 border-b border-[var(--surface-border)] px-4 py-3 text-left text-sm last:border-0 ${
                    isActive
                      ? "bg-[var(--surface-inset)]"
                      : "hover:bg-[var(--surface-inset)]"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate font-medium text-ink">
                      {t.visitorName}
                    </span>
                    {isUnread && (
                      <span
                        aria-label="Unread"
                        className="h-2 w-2 shrink-0 rounded-full bg-brand-magenta"
                      />
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-faint">
                    {t.visitorEmail}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                    {CHAT_THREAD_STATUS_LABELS[t.status]} ·{" "}
                    {relTime(t.lastMessageAt)}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Conversation pane */}
      <section className="flex h-[36rem] flex-col rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]">
        {!activeThread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">
            Select a thread.
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-[var(--surface-border)] px-4 py-3">
              <div>
                <div className="text-sm font-medium text-ink">
                  {activeThread.visitorName}
                </div>
                <div className="text-xs text-ink-faint">
                  {activeThread.visitorEmail} ·{" "}
                  {CHAT_THREAD_STATUS_LABELS[activeThread.status]}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeThread.status === "open" ? (
                  <form
                    action={async (fd) => {
                      fd.set("threadId", activeThread.id);
                      await closeChatThread(fd);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs hover:bg-[var(--surface-inset)]"
                    >
                      Close
                    </button>
                  </form>
                ) : (
                  <form
                    action={async (fd) => {
                      fd.set("threadId", activeThread.id);
                      await reopenChatThread(fd);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs hover:bg-[var(--surface-inset)]"
                    >
                      Reopen
                    </button>
                  </form>
                )}
              </div>
            </header>

            <div
              ref={messageListRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            >
              {activeMessages.length === 0 && (
                <div className="text-xs text-ink-faint">No messages yet.</div>
              )}
              {activeMessages.map((m) => (
                <Bubble key={m.id} message={m} />
              ))}
            </div>

            <form
              className="border-t border-[var(--surface-border)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend(e.currentTarget);
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  name="body"
                  required
                  maxLength={4000}
                  rows={2}
                  placeholder="Reply…"
                  className="flex-1 resize-none rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const form = e.currentTarget.form;
                      if (form) void handleSend(form);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "#D828A0" }}
                >
                  Send
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function upsertThread(prev: ChatThread[], next: ChatThread): ChatThread[] {
  const existing = prev.findIndex((t) => t.id === next.id);
  let merged: ChatThread[];
  if (existing === -1) {
    merged = [next, ...prev];
  } else {
    merged = [...prev];
    merged[existing] = next;
  }
  // Re-apply the open-first / newest-message-first ordering.
  return merged.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });
}

function Bubble({ message }: { message: ChatMessage }) {
  const fromAdmin = message.sender === "admin";
  return (
    <div className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
          fromAdmin
            ? "bg-brand-magenta text-white"
            : "bg-[var(--surface-inset)] text-ink"
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
