/**
 * Member profile writes.
 *
 * Split out of app/(app)/profile/edit/_shared.tsx on 2026-09-22 so the
 * identity form could become a client component. _shared.tsx imports
 * db/client for its loader, and a client component importing from
 * there would pull Postgres into the browser bundle, which the client
 * boundary guard fails on.
 *
 * saveProfile RETURNS its outcome rather than throwing. Next strips
 * server-action error messages in production, so a thrown validation
 * error arrives at the member as a blank error page with no
 * explanation. Same pattern as submitJobApplication.
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users as usersTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  findSelfDisclosure,
  type DisclosureFinding,
} from "@/lib/self-disclosure-guard";
import type { Industry } from "@/lib/types";

const ALL_INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

export interface BlockedField extends DisclosureFinding {
  field: "bio" | "tagline";
}

export interface SaveProfileResult {
  ok: boolean;
  /** Empty on success. Every problem at once, not the first one. */
  blocked: BlockedField[];
  message: string;
}

export async function saveProfile(
  formData: FormData,
): Promise<SaveProfileResult> {
  // Always resolve the writer from the actual session, not from a
  // hidden form field. Fixes the bug Rob hit: real Auth.js users
  // (like Rob, invited via Track A) weren't in the fixture array, so
  // the old lookup returned undefined and threw
  // "User not found" — everyone saw a broken save.
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { ok: false, blocked: [], message: "Sign in required." };
  }
  const uid = currentUser.id;

  // Compose the update patch from the form. Blank strings become
  // null for nullable columns; primaries fall back to current
  // values when empty so we don't clobber good data with a whitespace
  // submit.
  const firstName =
    String(formData.get("firstName") ?? "").trim() || currentUser.firstName;
  const lastName =
    String(formData.get("lastName") ?? "").trim() || currentUser.lastName;
  // The alias is artist-only, and the rule lives here rather than only
  // in the markup: a contributor has no alias field on the form, and a
  // hand-posted one is ignored. Their stored value is preserved rather
  // than cleared, so it comes back intact if they are recognised as an
  // artist later.
  //
  // For an artist, empty clears it and falls back to the first-name
  // convention, so someone can undo an alias without an admin.
  const displayName =
    currentUser.profileMode === "epk"
      ? String(formData.get("displayName") ?? "").trim() || null
      : (currentUser.displayName ?? null);
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const rawTagline = String(formData.get("tagline") ?? "").trim();
  const tagline = rawTagline ? rawTagline.slice(0, 120) : null;
  const portfolioUrl =
    String(formData.get("portfolioUrl") ?? "").trim() || null;
  const profileImageUrl =
    String(formData.get("profileImageUrl") ?? "").trim() || null;

  const primaryRaw = String(formData.get("primaryIndustry") ?? "") as Industry;
  const primaryIndustry: Industry | null = ALL_INDUSTRIES.includes(primaryRaw)
    ? primaryRaw
    : currentUser.primaryIndustry;

  // Secondary pillars are checkbox values. Exclude the primary so
  // we never double-count.
  const rawSecondaries = formData.getAll("secondaryIndustries").map(String);
  const secondaryIndustries = rawSecondaries
    .filter((v): v is Industry => ALL_INDUSTRIES.includes(v as Industry))
    .filter((v) => v !== primaryIndustry);

  const skillsRaw = String(formData.get("skills") ?? "");
  const skills = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Guard the two free-text fields before anything is written.
  //
  // Blocking rather than redacting is deliberate: a member reading
  // "[redacted] is a dedicated disruptor" on their own profile learns
  // nothing, while a member still in the editor with the text in front
  // of them can fix it. Both fields are checked in one pass so they
  // are not discovered one at a time.
  const blocked = [
    ...findSelfDisclosure(bio, currentUser).map((f) => ({
      ...f,
      field: "bio" as const,
    })),
    ...findSelfDisclosure(tagline, currentUser).map((f) => ({
      ...f,
      field: "tagline" as const,
    })),
  ];
  if (blocked.length > 0) {
    return {
      ok: false,
      blocked,
      message:
        "Nothing was saved. Public surfaces name members by first name and last initial so a client cannot route around the cooperative, and the text below works against that.",
    };
  }

  const updatedAt = new Date().toISOString();

  // Real Postgres write. Wrapped in try so mock-only users
  // (view-as / seeded sandbox accounts that don't have a
  // Postgres row) still get their profile updated via the mock
  // path fallback — no regression for the dev/demo flow.
  // Writes straight to Postgres. No in-memory fallback: silently
  // "succeeding" into a mock array meant a member could edit their
  // profile, see a success state, and have nothing persist. Better to
  // surface the failure than to lie about it.
  const res = await db
    .update(usersTable)
    .set({
      firstName,
      displayName,
      lastName,
      bio,
      tagline,
      portfolioUrl,
      profileImageUrl,
      primaryIndustry,
      secondaryIndustries,
      skills,
      updatedAt,
    })
    .where(eq(usersTable.id, uid))
    .returning({ id: usersTable.id });

  if (res.length === 0) {
    // Returned rather than thrown. Next strips server-action error
    // messages in production, so a throw here reaches the member as a
    // blank error page.
    return {
      ok: false,
      blocked: [],
      message: "Could not save your profile. No matching account was found.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${currentUser.handle}`);
  return { ok: true, blocked: [], message: "Profile saved." };
}
