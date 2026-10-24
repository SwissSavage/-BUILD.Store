/**
 * Chat realtime fan-out, across replicas.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-24, #241)
 *
 * This was a Node EventEmitter pinned to globalThis. Inside one process
 * that is correct and fast. The app runs more than one replica under
 * Swarm, and an EventEmitter is per process, so:
 *
 *   visitor types  → lands on replica A → A emits → A's SSE clients see it
 *   admin is on replica B → B never emitted anything → nothing arrives
 *
 * Nobody gets an error. The admin queue is right the next time the page
 * is loaded, because the messages themselves have been in Postgres since
 * 2026-09-03. Only the push was local. So the failure looks like a slow
 * admin rather than a broken feature, which is the worst way for it to
 * look: the visitor watches an unanswered message and concludes they
 * were ignored.
 *
 * WHY LISTEN/NOTIFY AND NOT REDIS
 *
 * The transport has to be shared, and the only shared thing this app
 * already has is Postgres. Adding Redis means another service to run,
 * pay for and lose, for one channel of small events. Postgres
 * LISTEN/NOTIFY is in the database that is already a hard dependency:
 * if it is down, chat is down anyway.
 *
 * WHY THE PAYLOAD IS ONLY IDENTIFIERS
 *
 * NOTIFY payloads are capped at 8000 bytes and a thread plus a 4000
 * character message can exceed that. More importantly, a payload
 * carrying its own copy of the row is a second source of truth that can
 * disagree with the table. So the notification says "message M on
 * thread T changed" and the receiving replica reads the rows. One
 * authority, and the size cap stops being a consideration.
 *
 * WHY IT STILL EMITS LOCALLY FIRST
 *
 * The replica that handled the write already has the objects in hand.
 * Emitting locally keeps same-replica delivery at zero added latency
 * and means chat degrades to exactly its old behaviour, rather than
 * breaking, if the notify leg fails. `origin` on the payload is how the
 * emitting replica recognises its own echo and drops it.
 *
 * WHY IT MAY NOT WORK, AND WHY THAT IS NOT FATAL
 *
 * Production is Supabase. Its transaction-mode pooler (port 6543) does
 * NOT support LISTEN/NOTIFY: a session-level registration cannot
 * survive a pooler that hands the connection to someone else between
 * statements. A session-mode or direct connection (5432) does support
 * it. DATABASE_URL may point at either, and this module cannot tell
 * which from the inside, so it tries, says loudly in the log what
 * happened, and falls back to local-only delivery. Chat keeps working
 * the way it does today; it just is not cross-replica until the URL is
 * right. CHAT_EVENTS_DATABASE_URL overrides the connection for this
 * listener alone, which is the escape hatch when the app should keep
 * using the pooler for everything else.
 * ─────────────────────────────────────────────────────────────
 */
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { pool } from "@/db/client";
import { getMessageById, getThreadById } from "@/lib/writers/chat";
import type { ChatMessage, ChatThread } from "@/lib/types";

export type ChatEvent =
  | { kind: "thread.created"; thread: ChatThread }
  | { kind: "thread.updated"; thread: ChatThread }
  | { kind: "message.created"; message: ChatMessage; thread: ChatThread };

/** What actually crosses the wire. Identifiers, nothing else. */
interface ChatNotification {
  kind: ChatEvent["kind"];
  threadId: string;
  messageId?: string;
  /** Which replica published it, so it can ignore its own echo. */
  origin: string;
}

const CHANNEL = "chat_events";
const EMITTER_KEY = "__build_store_chat_emitter__";
const LISTENER_KEY = "__build_store_chat_listener__";
const ORIGIN_KEY = "__build_store_chat_origin__";

interface ListenerState {
  client: Client | null;
  starting: Promise<void> | null;
  /** Set once the connection is known not to support LISTEN. */
  unsupported: boolean;
  retries: number;
  timer: NodeJS.Timeout | null;
}

type GlobalWithChat = typeof globalThis & {
  [EMITTER_KEY]?: EventEmitter;
  [LISTENER_KEY]?: ListenerState;
  [ORIGIN_KEY]?: string;
};

/**
 * Pinned to globalThis, as before: Next.js recompiles modules on every
 * code change in dev and a fresh emitter would orphan every subscribed
 * SSE stream. The listener state is pinned for the same reason, plus a
 * second one — a new module instance must not open a second LISTEN
 * connection and leak the first.
 */
function g(): GlobalWithChat {
  return globalThis as GlobalWithChat;
}

function getEmitter(): EventEmitter {
  const global = g();
  if (!global[EMITTER_KEY]) {
    const ee = new EventEmitter();
    // Each SSE connection adds a listener, and dev hot-reloads leave
    // dangling ones around.
    ee.setMaxListeners(100);
    global[EMITTER_KEY] = ee;
  }
  return global[EMITTER_KEY]!;
}

/** This process's identity, stable for its lifetime. */
function origin(): string {
  const global = g();
  if (!global[ORIGIN_KEY]) global[ORIGIN_KEY] = randomUUID();
  return global[ORIGIN_KEY]!;
}

function listenerState(): ListenerState {
  const global = g();
  if (!global[LISTENER_KEY]) {
    global[LISTENER_KEY] = {
      client: null,
      starting: null,
      unsupported: false,
      retries: 0,
      timer: null,
    };
  }
  return global[LISTENER_KEY]!;
}

/**
 * Publish to every replica, including this one.
 *
 * Signature stays synchronous and returns void, because all eleven call
 * sites in chat-actions treat it that way and none of them should start
 * awaiting a fan-out. The message is already committed to Postgres by
 * the time this runs; a failed notification costs a live update, not
 * data. So it is fire-and-forget with a logged failure, deliberately.
 */
export function emitChatEvent(event: ChatEvent): void {
  // Local first. Same-replica subscribers get the objects already in
  // hand, with no database round trip and nothing to rehydrate.
  getEmitter().emit("chat", event);

  const payload: ChatNotification = {
    kind: event.kind,
    threadId: event.thread.id,
    messageId: event.kind === "message.created" ? event.message.id : undefined,
    origin: origin(),
  };

  // pg_notify rather than a NOTIFY statement: NOTIFY takes no bind
  // parameters, so the channel and payload would have to be
  // string-interpolated into SQL.
  void pool
    .query("select pg_notify($1, $2)", [CHANNEL, JSON.stringify(payload)])
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[chat] notify failed, event stayed on this replica", err);
    });
}

/** Subscribe to all chat events. Returns an unsubscribe handle. */
export function subscribeChatEvents(
  handler: (event: ChatEvent) => void,
): () => void {
  // Started here rather than at module load: a process that never
  // streams (a build, a cron container, a one-off script) has no
  // reason to hold a dedicated Postgres connection open.
  void startListener();

  const ee = getEmitter();
  ee.on("chat", handler);
  return () => {
    ee.off("chat", handler);
  };
}

/**
 * Hold one dedicated connection open with LISTEN registered on it.
 *
 * Deliberately NOT from the shared pool. LISTEN is session state, and a
 * pool hands its clients to whoever asks next, so the registration
 * would end up on a connection serving unrelated queries and be
 * discarded when that client was recycled.
 */
async function startListener(): Promise<void> {
  const state = listenerState();
  if (state.client || state.unsupported) return;
  if (state.starting) return state.starting;

  state.starting = (async () => {
    const connectionString =
      process.env.CHAT_EVENTS_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      state.unsupported = true;
      return;
    }

    const client = new Client({ connectionString });

    // A dropped LISTEN connection is silent: no error on the next
    // write, just no more events. Reconnect, and say so.
    client.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[chat] listen connection error", err);
      scheduleReconnect();
    });
    client.on("end", () => {
      scheduleReconnect();
    });

    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      void handleNotification(msg.payload);
    });

    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      state.client = client;
      state.retries = 0;
      // eslint-disable-next-line no-console
      console.info(`[chat] listening on ${CHANNEL}, replica ${origin()}`);
    } catch (err) {
      await client.end().catch(() => {});
      state.client = null;
      // Anything that looks like the pooler refusing session state is
      // permanent for this URL. Retrying it every few seconds forever
      // would fill the log with the same line and never succeed.
      const message = err instanceof Error ? err.message : String(err);
      if (/unsupported|not supported|prepared statement|pgbouncer/i.test(message)) {
        state.unsupported = true;
        // eslint-disable-next-line no-console
        console.error(
          "[chat] this connection cannot LISTEN, so chat is not cross-replica. " +
            "Point CHAT_EVENTS_DATABASE_URL at a session-mode or direct Postgres " +
            "connection (Supabase port 5432, not the 6543 transaction pooler).",
          message,
        );
        return;
      }
      // eslint-disable-next-line no-console
      console.error("[chat] could not start the listener", err);
      scheduleReconnect();
    } finally {
      state.starting = null;
    }
  })();

  return state.starting;
}

/**
 * Backoff, capped. A database that is down takes the whole app with it,
 * so there is no point hammering it from here; and when it comes back,
 * thirty seconds of missed live updates is a page refresh, not a loss,
 * because the messages are in the table either way.
 */
function scheduleReconnect(): void {
  const state = listenerState();
  if (state.unsupported || state.timer) return;
  if (state.client) {
    void state.client.end().catch(() => {});
    state.client = null;
  }
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(state.retries, 5));
  state.retries += 1;
  state.timer = setTimeout(() => {
    state.timer = null;
    void startListener();
  }, delay);
  // Do not hold the process open purely to retry a chat connection.
  state.timer.unref?.();
}

/**
 * Turn another replica's notification back into a local event.
 *
 * Reads the rows rather than trusting the payload, which is the whole
 * reason the payload is only identifiers. A row that has since been
 * deleted simply produces nothing.
 */
async function handleNotification(raw: string): Promise<void> {
  let payload: ChatNotification;
  try {
    payload = JSON.parse(raw) as ChatNotification;
  } catch {
    // eslint-disable-next-line no-console
    console.error("[chat] unparseable notification payload", raw);
    return;
  }
  // Our own echo. The local emit already happened in emitChatEvent.
  if (payload.origin === origin()) return;
  if (!payload.threadId) return;

  try {
    const thread = await getThreadById(payload.threadId);
    if (!thread) return;

    if (payload.kind === "message.created") {
      if (!payload.messageId) return;
      const message = await getMessageById(payload.messageId);
      if (!message) return;
      getEmitter().emit("chat", { kind: "message.created", message, thread });
      return;
    }

    getEmitter().emit("chat", { kind: payload.kind, thread });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[chat] could not rehydrate a notification", err);
  }
}
