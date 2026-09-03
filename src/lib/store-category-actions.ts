/**
 * Store category admin lifecycle actions.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS MOVED (2026-09-03)
 *
 * This file used to push and mutate `MOCK_STORE_CATEGORIES`, an
 * in-memory array. `/admin/categories` read the same array, so an
 * admin creating or renaming a category saw it appear in the admin
 * list and reasonably concluded it had worked.
 *
 * The public store did not read that array. `/store` and
 * `StoreDropdown` both read `storeCategoryReader`, which is Postgres.
 * So the category never appeared to a customer, and on the next deploy
 * it was gone from the admin list too.
 *
 * This is the write-here-read-there bug that has now hit the
 * walkthrough, feedback, inbound submissions, recognitions,
 * canonizations, agreements and the profile. It is the worst-behaved
 * variant of it: the surface that would tell you something is wrong is
 * the same surface reading the fake data, so it looks like a success
 * every time.
 *
 * Reader and writer now both point at `store_categories`. The admin
 * page reads through `storeCategoryReader`, the same reader the public
 * store uses, so the two cannot disagree about what exists.
 *
 * Slug uniqueness is enforced by the unique index on the column, not
 * by a read-then-write check. The old `isSlugAvailable` helper read
 * the fixture, and even against real rows a select-then-insert loses
 * to a concurrent submit.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeCategories } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import type { MarketplaceCategory } from "@/lib/types";

const MARKETPLACE_VERTICALS: ReadonlyArray<MarketplaceCategory> = [
  "goods",
  "saas",
  "energy",
  "creative-services",
  "clothing",
];

function nullableString(raw: FormDataEntryValue | null): string | null {
  const v = String(raw ?? "").trim();
  return v.length === 0 ? null : v;
}

function parseVertical(
  raw: FormDataEntryValue | null,
): MarketplaceCategory | null {
  const v = String(raw ?? "").trim();
  if (v.length === 0) return null;
  if (!(MARKETPLACE_VERTICALS as ReadonlyArray<string>).includes(v)) {
    throw new Error(`Unknown vertical: ${v}`);
  }
  return v as MarketplaceCategory;
}

function parseSlug(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v.length === 0) throw new Error("Slug is required");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(v)) {
    throw new Error(
      "Slug must be lowercase letters, numbers, and hyphens only.",
    );
  }
  return v;
}

function parseDisplayOrder(raw: FormDataEntryValue | null): number {
  const n = Number(raw ?? 100);
  if (!Number.isFinite(n) || n < 0 || n > 9999) {
    throw new Error("Display order must be between 0 and 9999");
  }
  return Math.round(n);
}

/**
 * Postgres reports a duplicate slug as a constraint violation. Turn it
 * into something an admin can act on, rather than the raw driver
 * error, which in production is stripped to "an error occurred" and
 * tells them nothing at all.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/** Create a new store category. Slug must be unique. */
export async function createStoreCategory(formData: FormData) {
  await requireAdmin();

  const slug = parseSlug(formData.get("slug"));
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) throw new Error("Name is required");

  const now = new Date().toISOString();

  try {
    await db.insert(storeCategories).values({
      id: `cat_${randomUUID()}`,
      slug,
      name,
      description: nullableString(formData.get("description")),
      displayOrder: parseDisplayOrder(formData.get("displayOrder")),
      isActive: String(formData.get("isActive") ?? "") === "on",
      vertical: parseVertical(formData.get("vertical")),
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error(`Slug "${slug}" is already in use.`);
    }
    throw err;
  }

  revalidatePath("/admin/categories");
  revalidatePath("/store");
}

/** Update an existing category. Slug can change but must stay unique. */
export async function updateStoreCategory(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Category id is required");

  const slug = parseSlug(formData.get("slug"));
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) throw new Error("Name is required");

  let updated;
  try {
    updated = await db
      .update(storeCategories)
      .set({
        slug,
        name,
        description: nullableString(formData.get("description")),
        displayOrder: parseDisplayOrder(formData.get("displayOrder")),
        isActive: String(formData.get("isActive") ?? "") === "on",
        vertical: parseVertical(formData.get("vertical")),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storeCategories.id, id))
      .returning({ slug: storeCategories.slug });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error(`Slug "${slug}" is already in use.`);
    }
    throw err;
  }

  if (updated.length === 0) throw new Error("Category not found.");

  revalidatePath("/admin/categories");
  revalidatePath("/store");
  revalidatePath(`/store?category=${updated[0].slug}`);
}

/**
 * Soft-delete: flip isActive to false. Inactive categories do not show
 * in the dropdown or the filter chips, but products keep their
 * categorySlugs reference for audit.
 */
export async function archiveStoreCategory(formData: FormData) {
  await setActive(formData, false);
}

/** Re-enable an archived category. */
export async function unarchiveStoreCategory(formData: FormData) {
  await setActive(formData, true);
}

async function setActive(formData: FormData, isActive: boolean) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Category id is required");

  const changed = await db
    .update(storeCategories)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(eq(storeCategories.id, id))
    .returning({ id: storeCategories.id });

  if (changed.length === 0) throw new Error("Category not found.");

  revalidatePath("/admin/categories");
  revalidatePath("/store");
}
