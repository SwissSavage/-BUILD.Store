"use client";

/**
 * Floating visitor chat widget.
 *
 * Shows on public pages for logged-out visitors only (the parent
 * `<ChatWidgetMount>` server component decides whether to render this
 * based on session state).
 *
 * Three UI states:
 *   1. Collapsed — small floating button bottom-right.
 *   2. New conversation — name + email + first message form.
 *   3. Active conversation — message list + send box, SSE-subscribed
 *      to `/api/chat/stream/visitor` for admin replies.
 *
 * On open, the widget hydrates from `/api/chat/visitor` to learn
 * whether this browser already has a thread (cookie-keyed). If so it
 * jumps straight to the conversation view.
 *
 * Sandbox notes / production-swap:
 *   - Cookie name `chat_visitor_token` must match server-side. The
 *     server action sets it; this component never reads it directly
 *     (server route returns the visitor's view based on cookie).
 *   - SSE auto-reconnects via the browser's EventSource semantics.
 *     If we move to Vercel Functions later we'd need a manual
 *     reconnect with backoff; on a long-lived Node host this is fine.
 */

import { useEffect, useRef, useState } from "react";
import {
  markVisitorThreadRead,
  sendVisitorMessage,
  startVisitorThread,
} from "@/lib/chat-actions";
import type { ChatMessage, ChatThread } from "@/lib/types";

type WidgetState =
  | { phase: "loading" }
  | { phase: "intro" }
  | { phase: "active"; thread: ChatThread; messages: ChatMessage[] };

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<WidgetState>({ phase: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  // Hydrate on first open. Subsequent opens reuse loaded state.
  useEffect(() => {
    if (!isOpen) return;
    if (state.phase !== "loading") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/visitor", { cache: "no-store" });
        const data = (await res.json()) as {
          thread: ChatThread | null;
          messages?: ChatMessage[];
        };
        if (cancelled) return;
        if (data.thread) {
          setState({
            phase: "active",
            thread: data.thread,
            messages: data.messages ?? [],
          });
        } else {
          setState({ phase: "intro" });
        }
      } catch {
        if (!cancelled) setState({ phase: "intro" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, state.phase]);

  // SSE subscription whenever a thread is loaded.
  useEffect(() => {
    if (state.phase !== "active") return;
    const es = new EventSource("/api/chat/stream/visitor");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.kind === "message.created") {
          setState((prev) => {
            if (prev.phase !== "active") return prev;
            // Avoid duplicate appends if the visitor's own outgoing
            // message round-trips back through the SSE stream.
            if (prev.messages.some((m) => m.id === event.message.id)) {
              return prev;
            }
            return { ...prev, messages: [...prev.messages, event.message] };
          });
        } else if (event.kind === "thread.updated") {
          setState((prev) =>
            prev.phase === "active" ? { ...prev, thread: event.thread } : prev,
          );
        }
      } catch {
        // Ignore malformed frames.
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here unless we
      // want a UI hint.
    };
    return () => es.close();
  }, [state.phase, state.phase === "active" ? state.thread.id : null]);

  // Auto-scroll to newest message and mark visitor-read on update.
  useEffect(() => {
    if (state.phase !== "active") return;
    const el = messageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (isOpen) {
      void markVisitorThreadRead();
    }
  }, [state, isOpen]);

  async function handleStart(form: HTMLFormElement) {
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(form);
      const result = await startVisitorThread(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Pull the freshly created thread + first message from the
      // server. The cookie was set by the action; this read uses it.
      const ctx = await fetch("/api/chat/visitor", { cache: "no-store" });
      const data = (await ctx.json()) as {
        thread: ChatThread | null;
        messages?: ChatMessage[];
      };
      if (data.thread) {
        setState({
          phase: "active",
          thread: data.thread,
          messages: data.messages ?? [],
        });
        form.reset();
      }
    } finally {
      setPending(false);
    }
  }

  async function handleSend(form: HTMLFormElement) {
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(form);
      const body = String(fd.get("body") ?? "").trim();
      if (!body) {
        setError("Empty message.");
        return;
      }
      const result = await sendVisitorMessage(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Optimistic append — SSE will dedupe on id when it lands.
      setState((prev) => {
        if (prev.phase !== "active") return prev;
        const optimistic: ChatMessage = {
          id: `optimistic_${Date.now()}`,
          threadId: prev.thread.id,
          sender: "visitor",
          senderId: null,
          body,
          createdAt: new Date().toISOString(),
        };
        return { ...prev, messages: [...prev.messages, optimistic] };
      });
      form.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat with the cooperative"
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#D828A0" }}
        >
          <span>Chat with us</span>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chat with the cooperative"
          className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-inset)] px-4 py-3">
            <div>
              <div className="text-sm font-medium text-ink">
                Chat with the cooperative
              </div>
              <div className="text-[11px] text-ink-faint">
                {state.phase === "active"
                  ? state.thread.status === "open"
                    ? "Open. Replies usually within a day."
                    : "Closed. Send a new message to reopen."
                  : "Drop us a line, get a real reply"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 text-ink-faint hover:bg-[var(--surface-border)] hover:text-ink"
            >
              ✕
            </button>
          </header>

          {state.phase === "loading" && (
            <div className="flex-1 p-4 text-sm text-ink-muted">Loading…</div>
          )}

          {state.phase === "intro" && (
            <form
              className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleStart(e.currentTarget);
              }}
            >
              <p className="text-xs text-ink-muted">
                A real human reads every message. Tell us who you are and
                what you&apos;re trying to land. We&apos;ll route it.
              </p>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Name
                <input
                  name="visitorName"
                  required
                  maxLength={120}
                  className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                  placeholder="Your name"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Email
                <input
                  name="visitorEmail"
                  type="email"
                  required
                  maxLength={254}
                  className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                  placeholder="you@example.com"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
                What can we help with?
                <textarea
                  name="firstMessage"
                  required
                  maxLength={4000}
                  rows={4}
                  className="flex-1 resize-none rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                  placeholder="Looking to staff a project, exploring talent, just want to know more…"
                />
              </label>
              {error && (
                <div className="text-xs text-brand-magenta">{error}</div>
              )}
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] disabled:opacity-60"
              >
                {pending ? "Sending…" : "Start the chat"}
              </button>
            </form>
          )}

          {state.phase === "active" && (
            <>
              <div
                ref={messageListRef}
                className="flex-1 space-y-3 overflow-y-auto p-4"
              >
                {state.messages.length === 0 && (
                  <div className="text-xs text-ink-faint">
                    No messages yet.
                  </div>
                )}
                {state.messages.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
              </div>
              <form
                className="border-t border-[var(--surface-border)] p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend(e.currentTarget);
                }}
              >
                {error && (
                  <div className="mb-2 text-xs text-brand-magenta">
                    {error}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    name="body"
                    required
                    maxLength={4000}
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                    placeholder="Reply…"
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
        </div>
      )}
    </>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const fromVisitor = message.sender === "visitor";
  return (
    <div
      className={`flex ${fromVisitor ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
          fromVisitor
            ? "bg-brand-magenta text-white"
            : "bg-[var(--surface-inset)] text-ink"
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}
