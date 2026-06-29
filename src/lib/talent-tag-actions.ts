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
 * = "scrub" | "self" | "admin", confidence). Sandbox keeps the flat
 * string[] on the User row.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { deriveTalentTagsFromUser } from "@/lib/talent-match";

function findUser(userId: string) {
  const u = MOCK_USERS.find((x) => x.id === userId);
  if (!u) throw new Error("User not found");
  return u;
}

function bumpUpdated(userId: string): void {
  const u = MOCK_USERS.find((x) => x.id === userId);
  if (u) u.updatedAt = new Date().toISOString();
}

/** Member rescans their own tags from their profile. */
export async function rescanMyTalentTags() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const u = findUser(me.id);
  const derived = deriveTalentTagsFromUser(u);
  // Merge with existing curated tags so manually-added stay.
  const merged = new Set([...(u.talentTags ?? []), ...derived]);
  u.talentTags = Array.from(merged).slice(0, 80);
  bumpUpdated(me.id);
  revalidatePath("/profile");
}

/** Member removes a tag they don't want representing them. */
export async function removeMyTalentTag(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!tag) return;
  const u = findUser(me.id);
  u.talentTags = (u.talentTags ?? []).filter((t) => t !== tag);
  bumpUpdated(me.id);
  revalidatePath("/profile");
}

/** Member adds a tag manually. */
export async function addMyTalentTag(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const raw = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!raw) return;
  const additions = raw.split(/[\s,]+/).filter((t) => t.length > 0);
  const u = findUser(me.id);
  const next = new Set([...(u.talentTags ?? []), ...additions]);
  u.talentTags = Array.from(next).slice(0, 80);
  bumpUpdated(me.id);
  revalidatePath("/profile");
}

/** Admin override: rescan any member's tags. */
export async function adminRescanTalentTags(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const u = findUser(userId);
  u.talentTags = deriveTalentTagsFromUser(u);
  bumpUpdated(userId);
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
  const u = findUser(userId);
  const next = new Set([...(u.talentTags ?? []), ...additions]);
  u.talentTags = Array.from(next).slice(0, 80);
  bumpUpdated(userId);
  revalidatePath(`/admin/members/${userId}/tags`);
  revalidatePath("/admin/inbound");
}

/** Admin override: remove a tag. */
export async function adminRemoveTalentTag(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!tag) return;
  const u = findUser(userId);
  u.talentTags = (u.talentTags ?? []).filter((t) => t !== tag);
  bumpUpdated(userId);
  revalidatePath(`/admin/members/${userId}/tags`);
  revalidatePath("/admin/inbound");
}
