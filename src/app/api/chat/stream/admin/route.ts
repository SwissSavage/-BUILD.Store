/**
 * Admin-side SSE stream.
 *
 * Streams every chat event the system emits — new threads, new
 * messages on any thread, status flips. The admin chat surface
 * subscribes once and reconciles its own UI from the event stream.
 *
 * Gated behind requireAdmin(). Non-admin requests get 403.
 *
 * See visitor route's docstring for the rationale on SSE +
 * EventEmitter and the production-swap notes (Postgres LISTEN/NOTIFY,
 * long-lived Node host).
 */
import { getCurrentUser } from "@/lib/auth-stub";
import { subscribeChatEvents } from "@/lib/chat-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(data)));
        } catch {
          // Stream closed.
        }
      };

      send({ kind: "hello" });

      const unsubscribe = subscribeChatEvents((event) => send(event));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // Stream closed.
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
      "X-Accel-Buffering": "no",
    },
  });
}
