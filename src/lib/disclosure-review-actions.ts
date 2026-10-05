/**
 * Doing something about circumvention, rather than only seeing it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05)
 *
 * /admin/disclosure listed every bio and tagline the guard objected to
 * and offered two links out of the page. There was no way to clear a
 * finding, no way to tell the member, and no way to take a profile out
 * of discovery short of suspending the account. It told you where the
 * problem was and left you to go and do something about it by hand,
 * which meant nobody did.
 *
 * Three actions, in the order they should be reached for:
 *
 *   1. markDisclosureReviewed   you read it, it is fine, it leaves the
 *                               list until the member edits it again
 *   2. requestDisclosureFix     the member is asked to change their own
 *                               words, with the findings spelled out
 *   3. hideProfilePendingFix    the profile comes out of discovery while
 *                               it still says what it says
 *
 * The member fixing their own text is the first real move, not the last
 * resort. The save-time guard will refuse the bad version anyway, so
 * asking costs nothing and leaves the member their own voice.
 *
 * Nothing here edits a member's words for them. That was a deliberate
 * call when the guard was written: a member reading "[redacted] is a
 * dedicated disruptor" on their own profile learns nothing, and the
 * editor tells them exactly what to change while the text is still in
 * front of them.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profileDisclosureReviews, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import {
  hashDisclosureText,
  type DisclosureField,
} from "@/lib/disclosure-review";
import { getAllUsers, getUserById } from "@/lib/readers/users";
import { findSelfDisclosure } from "@/lib/self-disclosure-guard";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { notify } from "@/lib/writers/notifications";

function coerceField(raw: FormDataEntryValue | null): DisclosureField | null {
  const v = String(raw ?? "");
  return v === "bio" || v === "tagline" ? v : null;
}

/**
 * This text is acceptable. Take it off the list.
 *
 * Upserts on (user, field) so re-reviewing after an edit replaces the
 * decision rather than stacking a second one. The hash is of the text
 * as it stands right now, so the moment the member rewrites it the
 * review no longer matches and the row comes back.
 */
export async function markDisclosureReviewed(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  const field = coerceField(formData.get("field"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!uid || !field) return;

  const user = await getUserById(uid);
  if (!user) return;

  const current = field === "bio" ? user.bio : user.tagline;
  const textHash = hashDisclosureText(current);
  const now = new Date().toISOString();

  await db
    .insert(profileDisclosureReviews)
    .values({
      id: `pdr_${randomUUID()}`,
      userId: uid,
      field,
      textHash,
      reviewedBy: admin.id,
      reviewedAt: now,
      note,
    })
    .onConflictDoUpdate({
      target: [profileDisclosureReviews.userId, profileDisclosureReviews.field],
      set: { textHash, reviewedBy: admin.id, reviewedAt: now, note },
    });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "profile.disclosure_reviewed",
    resourceKind: "user",
    resourceId: uid,
    before: { field },
    after: { field, textHash, note },
  });

  revalidatePath("/admin/disclosure");
}

/**
 * Ask the member to rewrite it themselves.
 *
 * The findings go in the notification body verbatim, because a member
 * told "your bio has a problem" will guess wrong, and the one thing
 * worse than a bio naming its author is a member editing it four times
 * trying to work out what you meant.
 */
export async function requestDisclosureFix(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) return;

  const user = await getUserById(uid);
  if (!user) return;

  const findings = [
    ...findSelfDisclosure(user.tagline, user),
    ...findSelfDisclosure(user.bio, user),
  ];
  // Nothing to ask about. Most likely the member fixed it between the
  // page rendering and the button being pressed.
  if (findings.length === 0) return;

  const reasons = [...new Set(findings.map((f) => f.message))]
    .map((m) => `• ${m}`)
    .join("\n");

  await notify({
    userId: uid,
    kind: "profile_disclosure_fix",
    title: "Your profile text needs an edit",
    body: `Your public profile carries something that lets a client reach you around the cooperative. Please change it:\n\n${reasons}\n\nEdit it in your profile and save. The editor will tell you if anything is still outstanding.`,
    href: "/profile/edit/identity",
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "profile.disclosure_fix_requested",
    resourceKind: "user",
    resourceId: uid,
    before: {},
    after: { codes: findings.map((f) => f.code) },
  });

  revalidatePath("/admin/disclosure");
}

/**
 * Take the profile out of public discovery while it still says what it
 * says. Not a suspension: the member keeps their account, their work
 * and their access, and the profile returns the moment the text does.
 */
export async function hideProfilePendingFix(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("uid") ?? "").trim();
  if (!uid) return;

  const user = await getUserById(uid);
  if (!user) return;
  // Guarded so a double submit does not write a second audit entry
  // claiming the profile was hidden when it was already hidden.
  if (!user.profilePublic) return;

  await db
    .update(users)
    .set({ profilePublic: false, updatedAt: new Date().toISOString() })
    .where(and(eq(users.id, uid), eq(users.profilePublic, true)));

  await notify({
    userId: uid,
    kind: "profile_hidden_pending_fix",
    title: "Your profile is hidden for now",
    body: "Your public profile has been taken out of discovery because of what it says about how to reach you. Edit your bio and tagline and it goes back up. Your account, your work and your access are untouched.",
    href: "/profile/edit/identity",
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "profile.hidden_pending_fix",
    resourceKind: "user",
    resourceId: uid,
    before: { profilePublic: true },
    after: { profilePublic: false },
  });

  revalidatePath("/admin/disclosure");
  revalidatePath(`/u/${user.handle}`);
}

/**
 * Daily sweep: contact details in a live profile come down on their own.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05)
 *
 * Everything else on this page is a judgement call and waits for a
 * human. An email address, a phone number, a booking link or a bare
 * domain sitting in a public bio is not a judgement call. It is the
 * exact thing the no-circumvention rule exists to prevent, it is
 * machine-detectable with no ambiguity, and leaving it up until someone
 * happens to open the review page is the wrong default.
 *
 * So those four codes, and only those four, hide the profile
 * automatically and tell the member why. A full name or a company name
 * never triggers this: those need someone to read the sentence.
 *
 * A review on the current text suppresses the sweep, so an admin who
 * has looked at something and cleared it does not have it pulled down
 * overnight.
 *
 * Runs from the existing daily cron rather than a new one, so there is
 * no second scheduled task to configure in Dokploy.
 * ─────────────────────────────────────────────────────────────
 */
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
