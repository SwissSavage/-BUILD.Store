/**
 * /invite/[code] — root entry, branches by target tier.
 *
 * The invite form only allows Partner + Member (see /admin/members/invite),
 * but each tier gets a different ceremony:
 *
 *   - Member  → /letter (full care package: Letter → sign → Code → T&C)
 *   - Partner → /sign   (LOI only: sign → T&C, no Letter, no Code)
 *
 * Members earn the full ceremony because they'll be inside the room and
 * the Code carries load-bearing meaning for their participation. Partners
 * are vouched-in external contributors on scoped engagements — they need
 * the covenant + platform terms, not the induction ritual.
 *
 * Anything else (revoked / expired / consumed / not-found) → 404.
 */
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inviteLinks } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function InviteRootPage({
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
  if (!invite) notFound();
  if (invite.revokedAt) notFound();
  if (invite.consumedAt) notFound();
  if (new Date(invite.expiresAt) < new Date()) notFound();

  if (invite.targetTier === "member") {
    redirect(`/invite/${code}/letter`);
  }
  // Partner (only other invitable tier per the invite form restriction)
  // skips the Letter and goes straight to the signing bridge.
  redirect(`/invite/${code}/sign`);
}
