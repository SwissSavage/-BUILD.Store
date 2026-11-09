import { subscribeCommunityUpdates } from "@/lib/chat-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (frame: string) => {
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          // The client has disconnected.
        }
      };
      const unsubscribe = subscribeCommunityUpdates(() => send("data: update\n\n"));
      const heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        cleanup = undefined;
        try { controller.close(); } catch { /* Already closed. */ }
      };
      request.signal.addEventListener("abort", () => cleanup?.(), { once: true });
      send(": connected\n\n");
    },
    cancel() { cleanup?.(); },
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
