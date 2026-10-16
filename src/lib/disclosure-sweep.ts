/**
 * Circumvention sweep — pulls a public bio carrying contact details out of discovery.
 *
 * Deliberately NOT a "use server" module. Moved out of
 * disclosure-review-actions.ts on 2026-10-16 so that it stops being a
 * public POST endpoint with a content-hashed id.
 *
 * A CRON_SECRET check used to sit at the top of this function. It
 * closed the exposure and broke the admin path in the same move,
 * because an admin has no way to hold a cron secret. The exposure
 * came from the file, so the fix is the file. Authorisation belongs
 * to the callers, each of which already holds a real credential:
 * the cron route checks a constant-time bearer token, and any admin
 * entry point checks requireAdmin().
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profileDisclosureReviews, users } from "@/db/schema";
import {
  hashDisclosureText,
  type DisclosureField,
} from "@/lib/disclosure-review";
import { getAllUsers } from "@/lib/readers/users";
import { findSelfDisclosure } from "@/lib/self-disclosure-guard";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { notify } from "@/lib/writers/notifications";

const AUTO_HIDE_CODES = new Set(["email", "phone", "booking_link", "external_url"]);

export async function runDisclosureSweep(): Promise<{
  scanned: number;
  hidden: number;
}> {
  const { users: roster } = await getAllUsers();
  const live = roster.filter((u) => u.profilePublic && !u.suspendedAt);

  const reviews = await db.select().from(profileDisclosureReviews);
  const cleared = new Map(
    reviews.map((r) => [`${r.userId}:${r.field}`, r.textHash]),
  );

  let hidden = 0;
  for (const user of live) {
    const fields: { field: DisclosureField; text: string | null | undefined }[] = [
      { field: "bio", text: user.bio },
      { field: "tagline", text: user.tagline },
    ];

    const offending = fields.filter(({ field, text }) => {
      if (cleared.get(`${user.id}:${field}`) === hashDisclosureText(text)) {
        return false;
      }
      return findSelfDisclosure(text, user).some((f) =>
        AUTO_HIDE_CODES.has(f.code),
      );
    });
    if (offending.length === 0) continue;

    // Guarded on still being public, so two overlapping cron runs
    // cannot both notify the same member.
    const claimed = await db
      .update(users)
      .set({ profilePublic: false, updatedAt: new Date().toISOString() })
      .where(and(eq(users.id, user.id), eq(users.profilePublic, true)))
      .returning({ id: users.id });
    if (claimed.length === 0) continue;

    hidden += 1;

    await notify({
      userId: user.id,
      kind: "profile_hidden_pending_fix",
      title: "Your profile is hidden for now",
      body: `Your public profile carries a direct way to contact you, in your ${offending
        .map((o) => o.field)
        .join(" and ")}. Clients reach talent through the cooperative, so the profile is out of discovery until that text changes. Edit it and it goes back up.`,
      href: "/profile/edit/identity",
    });

    await logAuditEvent({
      actorUserId: user.id,
      actorRoleSnapshot: snapshotActorRole(null),
      action: "profile.hidden_pending_fix",
      resourceKind: "user",
      resourceId: user.id,
      before: { profilePublic: true },
      after: {
        profilePublic: false,
        by: "daily_sweep",
        fields: offending.map((o) => o.field),
      },
    });
  }

  return { scanned: live.length, hidden };
}

