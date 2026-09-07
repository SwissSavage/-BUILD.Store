/**
 * Talent-tag curation actions.
 *
 * Two surfaces use these:
 *   1. /profile — the member sees their auto-extracted tags and can
 *      rescan from their bio/skills/portfolio, or remove tags that
 *      don't represent them.
 *   2. /admin/members/[id]/tags — admin can do the same on any member's
 *      behalf and add curator-side tags ("retrofit", "policy") that
 *      the onboarding scrubber missed.
 *
 * Production swap stores tags in a join table with (userId, tag, source
 * = "scrub" | "self" | "admin", confidence). Today they are a flat
 * string[] in users.talent_tags, which is what these actions write.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-07)
 *
 * All six actions read the seed fixture array and assigned to the
 * object it returned. For a real member the lookup returned undefined
 * and findUser threw "User not found"; for a seed account it appeared
 * to work until the process restarted. Either way nothing was written,
 * while talent-match.ts reads users.talent_tags from Postgres. Matching
 * has been scoring against whatever the onboarding scrubber wrote and
 * nothing a member has changed since.
 *
 * The read-modify-write below is deliberate: a member edits their own
 * tags one at a time from one screen, and the admin surface is single
 * operator. If tag editing ever goes concurrent this wants moving into
 * the join table above, not a lock.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { getUserById } from "@/lib/readers/users";
import { deriveTalentTagsFromUser } from "@/lib/talent-match";

/** The member whose tags are being edited. Throws if they are gone. */
async function findUser(userId: string) {
  const u = await getUserById(userId);
  if (!u) throw new Error("User not found");
  return u;
}

/**
 * Persist the tag list. Guarded on the row existing so a deleted account
 * racing an edit fails loudly instead of reporting success.
 */
async function writeTags(userId: string, tags: string[]): Promise<void> {
  const saved = await db
    .update(users)
    .set({ talentTags: tags, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (saved.length === 0) {
    throw new Error("Could not save tags. The account was not found.");
  }
}

/** Member rescans their own tags from their profile. */
export async function rescanMyTalentTags() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const u = await findUser(me.id);
  const derived = deriveTalentTagsFromUser(u);
  // Merge with existing curated tags so manually-added stay.
  const merged = new Set([...(u.talentTags ?? []), ...derived]);
  await writeTags(me.id, Array.from(merged).slice(0, 80));
  revalidatePath("/profile");
}

/** Member removes a tag they don't want representing them. */
export async function removeMyTalentTag(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!tag) return;
  const u = await findUser(me.id);
  await writeTags(
    me.id,
    (u.talentTags ?? []).filter((t) => t !== tag),
  );
  revalidatePath("/profile");
}

/** Member adds a tag manually. */
export async function addMyTalentTag(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const raw = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!raw) return;
  const additions = raw.split(/[\s,]+/).filter((t) => t.length > 0);
  const u = await findUser(me.id);
  const next = new Set([...(u.talentTags ?? []), ...additions]);
  await writeTags(me.id, Array.from(next).slice(0, 80));
  revalidatePath("/profile");
}

/** Admin override: rescan any member's tags. */
export async function adminRescanTalentTags(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const u = await findUser(userId);
  await writeTags(userId, deriveTalentTagsFromUser(u));
  revalidatePath(`/admin/members/${userId}/tags`);
  revalidatePath("/admin/inbound");
}

/** Admin override: append a tag. */
export async function adminAddTalentTag(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const raw = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!raw) return;
  const additions = raw.split(/[\s,]+/).filter((t) => t.length > 0);
  const u = await findUser(userId);
  const next = new Set([...(u.talentTags ?? []), ...additions]);
  await writeTags(userId, Array.from(next).slice(0, 80));
  revalidatePath(`/admin/members/${userId}/tags`);
  revalidatePath("/admin/inbound");
}

/** Admin override: remove a tag. */
export async function adminRemoveTalentTag(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!tag) return;
  const u = await findUser(userId);
  await writeTags(
    userId,
    (u.talentTags ?? []).filter((t) => t !== tag),
  );
  revalidatePath(`/admin/members/${userId}/tags`);
  revalidatePath("/admin/inbound");
}
