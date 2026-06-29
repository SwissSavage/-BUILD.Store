/**
 * Admin live chat queue.
 *
 * Server component shell — fetches the initial thread list + messages
 * for the active thread, then hands off to <AdminChatBoard /> (client)
 * which subscribes to `/api/chat/stream/admin` for realtime updates.
 *
 * Auth: requireAdmin gates this surface. View-as flows pass through
 * normally — viewing-as a non-admin redirects them.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";
import { listThreads, listMessages } from "@/lib/mock-data/chat";
import { AdminChatBoard } from "@/components/AdminChatBoard";

export default async function AdminChatPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) redirect("/");

  const { thread: threadParam } = await searchParams;
  const threads = listThreads();
  const initialThreadId =
    threadParam && threads.some((t) => t.id === threadParam)
      ? threadParam
      : (threads[0]?.id ?? null);
  const initialMessages = initialThreadId ? listMessages(initialThreadId) : [];

  return (
    <div className="mx-auto max-w-app px-6 py-10">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin
      </Link>
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Live chat</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Anonymous visitors who reached out from the public site. Reply
            here; the visitor sees you in real time.
          </p>
        </div>
        <div className="text-xs text-ink-faint">
          {threads.filter((t) => t.status === "open").length} open ·{" "}
          {threads.filter((t) => t.status === "closed").length} closed
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
          No conversations yet. Visitors who use the chat widget on the
          public site land here.
        </div>
      ) : (
        <AdminChatBoard
          adminId={user.id}
          initialThreads={threads}
          initialThreadId={initialThreadId}
          initialMessages={initialMessages}
        />
      )}
    </div>
  );
}
