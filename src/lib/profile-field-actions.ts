/**
 * Save ONE block of your profile without touching the others.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * /profile is now the profile itself, with each block editable in
 * place. Jamar: "When you get on facebook, you just see your profile
 * and there are fields you can edit. Viewing your profile should be
 * what you see when you click your profile, not a secondary option."
 *
 * `saveProfile` in profile/edit/_shared cannot serve that. It composes
 * its patch from the whole form and writes every column every time, so
 * a form containing only a tagline field would submit an empty `bio`,
 * empty `skills` and no `secondaryIndustries`, and the write would
 * blank all three. That is not a hypothetical: the identity editor
 * already carries a hidden `profileImageUrl` field for exactly this
 * reason, with a comment explaining that without it the avatar gets
 * clobbered back to empty on the next save.
 *
 * The fix is to make the form declare what it is editing. A hidden
 * `section` field names the block; the action patches only that
 * block's columns and leaves the rest of the row alone. Nothing is
 * inferred from a field being absent, because an unchecked checkbox
 * and an omitted fieldset look identical in FormData and one of those
 * means "clear it" while the other means "not my business".
 *
 * The full-form `saveProfile` stays where it is. /profile/edit/identity
 * still uses it, and rewriting both at once during onboarding week is
 * how a working editor becomes two broken ones.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users as usersTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import type { Industry } from "@/lib/types";

const ALL_INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

/** The blocks that can be edited in place on /profile. */
const SECTIONS = [
  "name",
  "tagline",
  "bio",
  "pillars",
  "skills",
  "links",
] as const;

type Section = (typeof SECTIONS)[number];

function isSection(v: string): v is Section {
  return (SECTIONS as readonly string[]).includes(v);
}

/** Trimmed string, or null when the member cleared the field. */
function orNull(formData: FormData, key: string): string | null {
  return String(formData.get(key) ?? "").trim() || null;
}

export async function saveProfileSection(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");

  const sectionRaw = String(formData.get("section") ?? "").trim();
  if (!isSection(sectionRaw)) {
    throw new Error("Unknown profile section.");
  }
  const section: Section = sectionRaw;

  // Only the named section's columns go into the patch. Anything not
  // listed here keeps whatever is already in the row.
  const patch: Record<string, unknown> = {};

  switch (section) {
    case "name": {
      // First and last fall back to the current values rather than
      // going null. A member with no name is not a state the rest of
      // the app is prepared for, and publicName() would drop them to
      // "Unnamed" on every surface at once.
      patch.firstName =
        String(formData.get("firstName") ?? "").trim() || user.firstName;
      patch.lastName =
        String(formData.get("lastName") ?? "").trim() || user.lastName;
      // Display name DOES clear, so an alias can be undone without an
      // admin. Empty falls back to the first-name convention.
      patch.displayName = orNull(formData, "displayName");
      break;
    }

    case "tagline": {
      const raw = String(formData.get("tagline") ?? "").trim();
      patch.tagline = raw ? raw.slice(0, 120) : null;
      break;
    }

    case "bio": {
      patch.bio = orNull(formData, "bio");
      break;
    }

    case "pillars": {
      const primaryRaw = String(
        formData.get("primaryIndustry") ?? "",
      ) as Industry;
      const primaryIndustry: Industry | null = ALL_INDUSTRIES.includes(
        primaryRaw,
      )
        ? primaryRaw
        : user.primaryIndustry;

      // Unchecking every box is a legitimate answer here, and it is
      // safe because this branch only runs when the pillars form was
      // the thing submitted.
      const secondaryIndustries = formData
        .getAll("secondaryIndustries")
        .map(String)
        .filter((v): v is Industry => ALL_INDUSTRIES.includes(v as Industry))
        .filter((v) => v !== primaryIndustry);

      patch.primaryIndustry = primaryIndustry;
      patch.secondaryIndustries = secondaryIndustries;
      break;
    }

    case "skills": {
      patch.skills = String(formData.get("skills") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      break;
    }

    case "links": {
      patch.portfolioUrl = orNull(formData, "portfolioUrl");
      break;
    }
  }

  patch.updatedAt = new Date().toISOString();

  // Guarded write. `.returning()` so a member whose row is missing
  // gets an error instead of a silent success, which is the failure
  // mode that had people editing their profile and watching nothing
  // persist.
  const res = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, user.id))
    .returning({ id: usersTable.id });

  if (res.length === 0) {
    throw new Error(
      "Could not save. No matching account was found for this session.",
    );
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  if (user.handle) revalidatePath(`/u/${user.handle}`);

  // Redirect rather than fall through, for two reasons that are both
  // about the member being able to tell what happened:
  //
  //   1. The open <details> holding the form is DOM state. Without a
  //      navigation it stays open after the save, so the member is
  //      still looking at a form and has to infer from a spinner
  //      that stopped. Navigating re-renders it closed, and the new
  //      value is sitting there in its place.
  //   2. ?saved= lets the page mark which block just changed. Jamar:
  //      "there also needs to be some kind of clear confirmation that
  //      something has happened when you click buttons, or people
  //      will endlessly click buttons."
  //
  // This couples the action to /profile. That is deliberate: it is
  // the only surface with per-block forms, and a generic version
  // would need a redirect target passed through the form, which is a
  // user-supplied redirect and a thing to get wrong.
  redirect(`/profile?saved=${section}`);
}
