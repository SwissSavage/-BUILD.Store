/**
 * /community — public cooperative-wide message board (task #64).
 *
 * Anyone can read; only Partners + Members can post. Every post is
 * PII-scrubbed on write (task #39 scrubber) and rendered first-name-
 * only. Moderation lives on the row: author or admin can soft-delete,
 * admin can restore.
 *
 * Kept in the (public) route group so visitors can browse the
 * cooperative's live activity — the "engagement" half of the task
 * spec. Post form only renders when the signed-in user is Partner+.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { communityMessages, users as usersTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  postCommunityMessage,
  deleteCommunityMessage,
} from "@/lib/community-chat-actions";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

export const metadata: Metadata = {
  title: "Community — Future Modern",
  description:
    "Cooperative-wide message board. First-name-only, PII-scrubbed, member-posted.",
  alternates: { canonical: `${SITE_URL}/community` },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function CommunityChatPage() {
  const user = await getCurrentUser();
  const canPost =
    user?.membershipTier === "partner" || user?.membershipTier === "member";
  const isAdmin = user?.isAdmin === true;

  // Only surface non-deleted messages; freshest first. 100-message
  // window is plenty for beta traffic; pagination lands with volume.
  const rows = await db
    .select({
      id: communityMessages.id,
      userId: communityMessages.userId,
      scrubbedBody: communityMessages.scrubbedBody,
      piiHits: communityMessages.piiHits,
      createdAt: communityMessages.createdAt,
      firstName: usersTable.firstName,
      handle: usersTable.handle,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(communityMessages)
    .leftJoin(usersTable, eq(usersTable.id, communityMessages.userId))
    .where(isNull(communityMessages.deletedAt))
    .orderBy(desc(communityMessages.createdAt))
    .limit(100);

  // Fallback nav for the join CTA to soft-nudge viewers into signup.
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="text-xs uppercase tracking-wider text-brand-magentaText">
        Community
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Cooperative chat
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Public board for the cooperative. First names only. Posts are
        auto-scrubbed of emails, phone numbers, and off-platform
        booking links. Anyone can read; Partners and Members post.
      </p>

      {canPost ? (
        <Card className="mt-8">
          <CardEyebrow>New post</CardEyebrow>
          <form action={postCommunityMessage} className="mt-3 space-y-3">
            <textarea
              name="body"
              rows={3}
              required
              minLength={2}
              maxLength={1000}
              placeholder="Say something to the cooperative."
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-ink-faint">
                1000 char max. 30s cooldown between posts. Contact
                info gets scrubbed automatically.
              </p>
              <button
                type="submit"
                className="fm-btn-primary rounded-full px-5 py-2 text-sm font-medium"
              >
                Post
              </button>
            </div>
          </form>
        </Card>
      ) : user ? (
        <Card className="mt-8 border-brand-magenta/40 bg-brand-magenta/5">
          <p className="text-sm text-ink-muted">
            Viewer tier reads only. Partners and Members can post — ask
            an admin about the invite path.
          </p>
        </Card>
      ) : (
        <Card className="mt-8 border-brand-magenta/40 bg-brand-magenta/5">
          <p className="text-sm text-ink-muted">
            Sign in to post.{" "}
            <Link
              href="/signin?next=/community"
              className="text-brand-magentaText hover:underline"
            >
              Sign in
            </Link>
            {" "}or{" "}
            <Link
              href="/whitelist"
              className="text-brand-magentaText hover:underline"
            >
              join the whitelist
            </Link>
            {" "}for an invite.
          </p>
        </Card>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Latest ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              Quiet in here. First post takes it from silence to signal.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((r) => {
              const displayName =
                publicName({ firstName: r.firstName, lastName: null }) ||
                r.handle ||
                "Cooperative member";
              const canDelete = isAdmin || user?.id === r.userId;
              const hits = Array.isArray(r.piiHits)
                ? (r.piiHits as string[])
                : [];
              return (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <CardTitle className="text-sm">{displayName}</CardTitle>
                    <span className="text-[11px] text-ink-faint">
                      {relativeTime(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                    {r.scrubbedBody}
                  </p>
                  {hits.length > 0 && (
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-brand-magentaText">
                      Auto-scrubbed: {hits.join(", ")}
                    </p>
                  )}
                  {canDelete && (
                    <form action={deleteCommunityMessage} className="mt-3">
                      <input type="hidden" name="id" value={r.id} />
                      {isAdmin && user?.id !== r.userId && (
                        <input
                          type="text"
                          name="reason"
                          placeholder="Reason (optional, recorded)"
                          className="mr-2 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2 py-1 text-[11px] md:w-auto"
                        />
                      )}
                      <button
                        type="submit"
                        className="text-[11px] text-ink-faint hover:text-brand-magentaText"
                      >
                        {isAdmin && user?.id !== r.userId
                          ? "Moderate → remove"
                          : "Delete"}
                      </button>
                    </form>
                  )}
                </Card>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
