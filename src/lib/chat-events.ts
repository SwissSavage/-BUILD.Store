/**
 * Chat realtime fan-out.
 *
 * Single-process sandbox: a Node EventEmitter shared across server
 * actions and SSE route handlers. Server actions emit events when a
 * thread is created, a message lands, or status flips; SSE routes
 * subscribe and push to clients.
 *
 * REPLACE WITH (production):
 *   Cross-instance fanout via Postgres LISTEN/NOTIFY. Neon supports
 *   it natively, no extra infra. Each event becomes a NOTIFY on the
 *   `chat_events` channel; SSE handlers run a long-lived Postgres
 *   client that LISTENs and forwards messages to subscribed clients.
 *   Optional fallback: Redis pub/sub. NOT a third-party chat vendor —
 *   the cooperative owns this surface end to end.
 *
 * The emitter must be shared across hot reloads in dev — Next.js
 * recompiles modules and would otherwise spawn a fresh emitter on
 * every code change, orphaning subscribed SSE streams. We pin it to
 * `globalThis` so the same instance survives.
 */
import { EventEmitter } from "node:events";
import type { ChatMessage, ChatThread } from "@/lib/types";

export type ChatEvent =
  | { kind: "thread.created"; thread: ChatThread }
  | { kind: "thread.updated"; thread: ChatThread }
  | { kind: "message.created"; message: ChatMessage; thread: ChatThread };

const KEY = "__build_store_chat_emitter__";

type GlobalWithEmitter = typeof globalThis & {
  [KEY]?: EventEmitter;
};

function getEmitter(): EventEmitter {
  const g = globalThis as GlobalWithEmitter;
  if (!g[KEY]) {
    const ee = new EventEmitter();
    // Bump default listener cap — each visitor SSE connection adds a
    // listener and dev hot-reloads can leave dangling ones around.
    ee.setMaxListeners(100);
    g[KEY] = ee;
  }
  return g[KEY]!;
}

export function emitChatEvent(event: ChatEvent): void {
  getEmitter().emit("chat", event);
}

/** Subscribe to all chat events. Returns an unsubscribe handle. */
export function subscribeChatEvents(
  handler: (event: ChatEvent) => void,
): () => void {
  const ee = getEmitter();
  ee.on("chat", handler);
  return () => {
    ee.off("chat", handler);
  };
}
