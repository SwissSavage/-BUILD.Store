/**
 * Visitor-side SSE stream.
 *
 * Reads the `chat_visitor_token` cookie, subscribes to the chat
 * EventEmitter, and forwards events that touch THIS visitor's thread
 * only. The visitor only ever knows about their own conversation;
 * other threads stay isolated.
 *
 * SSE was chosen over WebSockets because the upload side (visitor
 * sends a message) is a normal POST/server action — only the push
 * side is realtime. SSE is built into the runtime, no third-party
 * vendor required.
 *
 * REPLACE WITH (production): the same EventEmitter pattern, but with
 * Postgres LISTEN/NOTIFY underneath so events fan out across
 * instances. Single Node host stays on this code path unchanged.
 *
 * Deployment caveat: Vercel Functions cap execution duration, so SSE
 * connections will die periodically and must reconnect. Long-lived
 * Node hosts (Fly.io, Railway, own VPS) don't have that problem and
 * are the recommended target — also better aligned with the locked
 * "vendor-agnostic stack" decision.
 */
import { cookies } from "next/headers";
import { subscribeChatEvents } from "@/lib/chat-events";
import { getThreadByVisitorToken } from "@/lib/mock-data/chat";

// SSE needs the Node runtime (or Edge w/ streaming) — the Edge
// runtime works in modern Next, but Node is the safer baseline given
// our use of node:events + node:crypto in the mocks.
export const runtime = "nodejs";
// Disable any caching layer in front of this stream.
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "chat_visitor_token";
const HEARTBEAT_MS = 25_000;

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const jar = await cookies();
  const token = jar.get(VISITOR_COOKIE)?.value;
  if (!token) {
    return new Response("Missing visitor token", { status: 401 });
  }
  const thread = getThreadByVisitorToken(token);
  if (!thread) {
    return new Response("Thread not found", { status: 404 });
  }
  const threadId = thread.id;
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(data)));
        } catch {
          // Stream already closed — bail.
        }
      };

      // Initial hello so the client's onopen fires immediately even
      // when there are no chat events to push yet.
      send({ kind: "hello", threadId });

      const unsubscribe = subscribeChatEvents((event) => {
        // Only forward events for this visitor's thread. Skip the
        // top-level thread.created event entirely — the visitor
        // already has their thread by the time this stream opens.
        if (event.kind === "thread.created") return;
        if (event.thread.id !== threadId) return;
        send(event);
      });

      // Heartbeat keeps proxies/load-balancers from idling out the
      // connection. Comment-only frames don't trigger client handlers.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // Stream closed mid-tick.
        }
      }, HEARTBEAT_MS);

      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // Browser closed the tab / network dropped → AbortSignal fires.
      request.signal.addEventListener("abort", () => {
        cleanup?.();
        cleanup = null;
      });
    },
    cancel() {
      cleanup?.();
      cleanup = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering (nginx)
    },
  });
}
