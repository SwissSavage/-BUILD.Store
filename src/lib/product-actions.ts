/**
 * Seller product lifecycle: list a product, edit it, take it down.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * Nothing in the codebase inserted into `products`. Not a fixture
 * writer, not a Postgres writer, nothing. `/admin/marketplace` had an
 * approve-or-reject queue reading real rows, the public `/store` read
 * `status = "active"`, and `isApprovedSeller` gated a seller
 * dashboard, so every surface downstream of a product existing was
 * built. The one that creates a product was not.
 *
 * The visible consequence: a member applies to sell, an admin approves
 * them, and then there is nowhere to go. The approval queue can only
 * ever be empty, and so can the store.
 *
 * A seller can only touch their own rows. `sellerId` comes from the
 * session, never from the form, which is the same fix applied to
 * saveProfile after Rob's "User not found": anything identity-shaped
 * arriving in a FormData is a suggestion, not a fact.
 *
 * A seller cannot set `status` to "active". Submitting moves a product
 * to "pending_review" and the admin queue decides. Letting a seller
 * write "active" would put unreviewed listings on the public store,
 * which is the entire thing the review queue exists to prevent.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { isApprovedSeller } from "@/lib/readers";
import type { MarketplaceCategory } from "@/lib/types";

const VERTICALS: ReadonlyArray<MarketplaceCategory> = [
  "goods",
  "saas",
  "energy",
  "creative-services",
  "clothing",
];

/** The seller behind this request, or a refusal. */
async function requireSeller() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");

  const approved = await isApprovedSeller(user.id);
  if (!approved) {
    throw new Error(
      "Your seller application has not been approved yet. Applications are reviewed by an admin.",
    );
  }
  return user;
}

function parseVertical(raw: FormDataEntryValue | null): MarketplaceCategory {
  const v = String(raw ?? "").trim();
  if (!(VERTICALS as ReadonlyArray<string>).includes(v)) {
    throw new Error("Pick a category.");
  }
  return v as MarketplaceCategory;
}

/**
 * Price as a numeric(12,2) string.
 *
 * Parsed from the form rather than trusted, and kept as a string all
 * the way to the column. Round-tripping money through a JS float is
 * how a $19.99 listing becomes $19.989999999999998.
 */
function parsePrice(raw: FormDataEntryValue | null): string {
  const cleaned = String(raw ?? "").trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error("Price must be a number, like 49 or 49.99.");
  }
  const n = Number(cleaned);
  if (n <= 0) throw new Error("Price must be more than zero.");
  if (n > 999_999) throw new Error("Price is too high for a store listing.");
  return n.toFixed(2);
}

function parseInventory(raw: FormDataEntryValue | null): number | null {
  const v = String(raw ?? "").trim();
  // Blank means "not a physical inventory item", which is a real
  // answer for services and digital goods, not a missing value.
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
    throw new Error("Inventory must be a whole number, or left blank.");
  }
  return n;
}

function parseList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) throw new Error("Give it a title.");

  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 30) {
    throw new Error(
      "Description must be at least 30 characters. This is what a buyer decides on.",
    );
  }

  return {
    title,
    description,
    category: parseVertical(formData.get("category")),
    price: parsePrice(formData.get("price")),
    inventoryCount: parseInventory(formData.get("inventoryCount")),
    tags: parseList(formData.get("tags")),
    categorySlugs: parseList(formData.get("categorySlugs")),
    imageUrls: parseList(formData.get("imageUrls")),
  };
}

/**
 * Create a listing.
 *
 * `submit` decides whether it lands as a draft the seller keeps
 * working on or goes straight into the admin queue. Either way the
 * seller does not get to write "active".
 */
export async function createProduct(formData: FormData) {
  const seller = await requireSeller();
  const fields = readFields(formData);
  const now = new Date().toISOString();

  await db.insert(products).values({
    id: `prd_${randomUUID()}`,
    sellerId: seller.id,
    ...fields,
    currency: "USD",
    status:
      String(formData.get("submit") ?? "") === "review"
        ? "pending_review"
        : "draft",
    adminNote: null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/profile/seller/products");
  revalidatePath("/admin/marketplace");
}

/**
 * Edit a listing you own.
 *
 * The `WHERE` carries the seller id, so a forged product id in the
 * form updates zero rows rather than someone else's listing. Checking
 * ownership with a separate SELECT first would leave a gap between the
 * check and the write.
 *
 * Editing an already-approved product drops it back to
 * `pending_review`. Otherwise a seller could get a modest listing
 * approved and then quietly rewrite it into something else on a live
 * public page.
 */
export async function updateProduct(formData: FormData) {
  const seller = await requireSeller();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Product id is required.");

  const fields = readFields(formData);

  const updated = await db
    .update(products)
    .set({
      ...fields,
      status: "pending_review",
      adminNote: null,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(products.id, id), eq(products.sellerId, seller.id)))
    .returning({ id: products.id });

  if (updated.length === 0) {
    throw new Error("That listing does not exist, or is not yours.");
  }

  revalidatePath("/profile/seller/products");
  revalidatePath("/admin/marketplace");
  revalidatePath("/store");
  revalidatePath(`/store/${id}`);
}

/**
 * Take a listing off the store without destroying it.
 *
 * Archive rather than delete: orders reference products by id when
 * rendering what somebody bought, and deleting the row turns a
 * buyer's order history into a set of blanks.
 */
export async function archiveProduct(formData: FormData) {
  await setProductStatus(formData, "archived");
}

/** Put an archived listing back into the review queue. */
export async function relistProduct(formData: FormData) {
  await setProductStatus(formData, "pending_review");
}

async function setProductStatus(
  formData: FormData,
  status: "archived" | "pending_review",
) {
  const seller = await requireSeller();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Product id is required.");

  const changed = await db
    .update(products)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(products.id, id), eq(products.sellerId, seller.id)))
    .returning({ id: products.id });

  if (changed.length === 0) {
    throw new Error("That listing does not exist, or is not yours.");
  }

  revalidatePath("/profile/seller/products");
  revalidatePath("/admin/marketplace");
  revalidatePath("/store");
}
