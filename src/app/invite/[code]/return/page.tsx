/**
 * /invite/[code]/return — post-Documenso landing router.
 *
 * Documenso's redirectUrl on the LOI envelope is document-level: both
 * the admin countersigner and the invitee return to the same URL after
 * signing. This route bounces them where they actually need to be:
 *
 *   - If the current session is an admin → /admin/members/invite
 *     (they just finished countersigning; land them back on the invite
 *     admin surface with a `countersigned=<id>` flag)
 *   - Otherwise (invitee) → /invite/[code]/code
 *     (they just finished signing; walk them into the T&C page)
 *
 * If the invite code has already been consumed we short-circuit to
 * /welcome; if it's unknown or revoked we render a graceful message.
 */
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inviteLinks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Returning… — Future Modern",
  robots: { index: false, follow: false },
};

export default async function InviteReturnPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!invite) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center text-ink-muted">
        <p>This invitation is no longer available.</p>
      </div>
    );
  }
  if (invite.revokedAt) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center text-ink-muted">
        <p>This invitation has been revoked.</p>
      </div>
    );
  }
  if (invite.consumedAt) {
    // Ceremony's already complete — send them to the welcome landing
    // (or dashboard if they're signed in).
    redirect(`/invite/${code}/welcome`);
  }

  const user = await getCurrentUser();
  if (user?.isAdmin) {
    redirect(`/admin/members/invite?countersigned=${invite.id}`);
  }
  // Invitee (or unauthenticated visitor who somehow landed here): send
  // to the T&C page.
  redirect(`/invite/${code}/code`);
}
