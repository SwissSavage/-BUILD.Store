/**
 * Store category taxonomy. User-facing browse navigation.
 *
 * **This file is the source of truth for what shows up in the Store
 * dropdown.** Add a new category by appending to `MOCK_STORE_CATEGORIES`
 * with a unique slug, a display name, an order number, and isActive=true.
 *
 * The shape mirrors the eventual Payload collection 1:1; when CMS comes
 * online, the migration is a script that ingests this array. Until then,
 * admin can also add/edit categories via /admin/categories which writes
 * to this in-memory list (sandbox only).
 *
 * Distinct from `MarketplaceCategory` in `types.ts`: that enum is the
 * internal vertical / subdomain classification (goods, saas, energy,
 * creative-services, clothing). StoreCategory is the user-facing taxonomy
 * (Hardware, Software, Music, etc.) that the dropdown surfaces. A
 * product carries both: `category` for routing, `categorySlugs` for
 * browse.
 *
 * REPLACE WITH: Payload collection `store-categories` OR a Drizzle table
 * `store_categories`. Helper functions in this file should keep the same
 * signatures so callers don't change.
 */
import type { StoreCategory } from "@/lib/types";

export const MOCK_STORE_CATEGORIES: StoreCategory[] = [
  {
    id: "cat_hardware",
    slug: "hardware",
    name: "Hardware",
    description:
      "Physical tools, gear, components. Everything from instrument cables to builder-built electronics.",
    displayOrder: 10,
    isActive: true,
    vertical: "goods",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  {
    id: "cat_software",
    slug: "software",
    name: "Software",
    description:
      "SaaS, scripts, plugins, and dev tools built by Future Modern members.",
    displayOrder: 20,
    isActive: true,
    vertical: "saas",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  {
    id: "cat_music",
    slug: "music",
    name: "Music",
    description:
      "Releases, beats, samples, and licensing from the Future Modern artist roster.",
    displayOrder: 30,
    isActive: true,
    vertical: "creative-services",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  {
    id: "cat_merchandise",
    slug: "merchandise",
    name: "Merchandise",
    description:
      "Branded goods, drops, and limited runs from the cooperative.",
    displayOrder: 40,
    isActive: true,
    vertical: "clothing",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  {
    id: "cat_shoes",
    slug: "shoes",
    name: "Shoes",
    description: "Footwear from cooperative-aligned makers.",
    displayOrder: 50,
    isActive: true,
    vertical: "clothing",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  {
    id: "cat_art",
    slug: "art",
    name: "Art",
    description:
      "Original visual work. Prints, originals, NFTs, photography.",
    displayOrder: 60,
    isActive: true,
    vertical: "creative-services",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  {
    id: "cat_energy",
    slug: "energy",
    name: "Energy",
    description: "Solar, batteries, and clean-energy products.",
    displayOrder: 70,
    isActive: true,
    vertical: "energy",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  {
    id: "cat_services",
    slug: "services",
    name: "Services",
    description:
      "Engagements you can scope and book. Design, consulting, dev contracting.",
    displayOrder: 80,
    isActive: true,
    vertical: "creative-services",
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
];

/** Active categories in display order. The sort key is the dropdown order. */
export function activeCategories(): StoreCategory[] {
  return MOCK_STORE_CATEGORIES.filter((c) => c.isActive).sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
}

/** Look up by slug. Returns null if not found OR if the category is inactive. */
export function activeCategoryBySlug(slug: string): StoreCategory | null {
  const c = MOCK_STORE_CATEGORIES.find((c) => c.slug === slug);
  if (!c || !c.isActive) return null;
  return c;
}

/** Admin view: includes inactive. Sorted by display order then name. */
export function allCategoriesForAdmin(): StoreCategory[] {
  return [...MOCK_STORE_CATEGORIES].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.name.localeCompare(b.name),
  );
}

/** Returns true when the slug is unique among all categories (for create/edit). */
export function isSlugAvailable(slug: string, excludeId?: string): boolean {
  return !MOCK_STORE_CATEGORIES.some(
    (c) => c.slug === slug && c.id !== excludeId,
  );
}
