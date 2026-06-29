/**
 * Visitor chat context — JSON endpoint for the floating widget.
 *
 * Returns the visitor's current thread + messages if they have a
 * `chat_visitor_token` cookie. Returns `{ thread: null }` otherwise.
 *
 * The widget calls this on first open instead of an SSE subscription
 * because (a) the initial state load doesn't need streaming and
 * (b) keeping it as plain JSON simplifies the client code.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getThreadByVisitorToken,
  listMessages,
} from "@/lib/mock-data/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "chat_visitor_token";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(VISITOR_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ thread: null });
  }
  const thread = getThreadByVisitorToken(token);
  if (!thread) {
    return NextResponse.json({ thread: null });
  }
  const messages = listMessages(thread.id);
  return NextResponse.json({ thread, messages });
}
