/**
 * Admin lazy-load endpoint — returns messages for a single thread.
 *
 * The admin board pre-loads the active thread server-side, but when
 * the admin clicks a different thread we fetch its messages here
 * rather than re-render the whole page. Gated behind requireAdmin.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-stub";
import { listMessages } from "@/lib/mock-data/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("thread");
  if (!threadId) {
    return NextResponse.json({ messages: [] });
  }
  return NextResponse.json({ messages: listMessages(threadId) });
}
