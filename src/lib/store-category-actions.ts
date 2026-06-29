/**
 * Store category admin lifecycle actions.
 *
 * Admin-gated. Sandbox writes to MOCK_STORE_CATEGORIES in memory.
 * Production swap: the same operations against a Payload collection
 * (preferred per locked CMS posture) or a Drizzle `store_categories`
 * table.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_STORE_CATEGORIES,
  isSlugAvailable,
} from "@/lib/mock-data/store-categories";
import type { MarketplaceCategory, StoreCategory } from "@/lib/types";

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
 * Create a new store category. Slug must be unique.
 */
export async function createStoreCategory(formData: FormData) {
  await requireAdmin();
  const slug = parseSlug(formData.get("slug"));
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) throw new Error("Name is required");
  if (!isSlugAvailable(slug)) {
    throw new Error(`Slug "${slug}" is already in use`);
  }

  const now = new Date().toISOString();
  const row: StoreCategory = {
    id: `cat_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    slug,
    name,
    description: nullableString(formData.get("description")),
    displayOrder: parseDisplayOrder(formData.get("displayOrder")),
    isActive: String(formData.get("isActive") ?? "") === "on",
    vertical: parseVertical(formData.get("vertical")),
    createdAt: now,
    updatedAt: now,
  };
  MOCK_STORE_CATEGORIES.push(row);

  revalidatePath("/admin/categories");
  revalidatePath("/store");
}

/**
 * Update an existing category. Slug can change but must stay unique.
 */
export async function updateStoreCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = MOCK_STORE_CATEGORIES.find((c) => c.id === id);
  if (!row) throw new Error("Category not found");

  const slug = parseSlug(formData.get("slug"));
  if (!isSlugAvailable(slug, id)) {
    throw new Error(`Slug "${slug}" is already in use`);
  }
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) throw new Error("Name is required");

  row.slug = slug;
  row.name = name;
  row.description = nullableString(formData.get("description"));
  row.displayOrder = parseDisplayOrder(formData.get("displayOrder"));
  row.isActive = String(formData.get("isActive") ?? "") === "on";
  row.vertical = parseVertical(formData.get("vertical"));
  row.updatedAt = new Date().toISOString();

  revalidatePath("/admin/categories");
  revalidatePath("/store");
  revalidatePath(`/store?category=${row.slug}`);
}

/**
 * Soft-delete: flip isActive to false. Inactive categories don't show
 * in the dropdown or filter chips, but products still keep their
 * categorySlugs reference for audit.
 */
export async function archiveStoreCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = MOCK_STORE_CATEGORIES.find((c) => c.id === id);
  if (!row) throw new Error("Category not found");
  row.isActive = false;
  row.updatedAt = new Date().toISOString();

  revalidatePath("/admin/categories");
  revalidatePath("/store");
}

/**
 * Re-enable an archived category.
 */
export async function unarchiveStoreCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = MOCK_STORE_CATEGORIES.find((c) => c.id === id);
  if (!row) throw new Error("Category not found");
  row.isActive = true;
  row.updatedAt = new Date().toISOString();

  revalidatePath("/admin/categories");
  revalidatePath("/store");
}
