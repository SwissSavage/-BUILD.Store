/**
 * /profile/seller/products — an approved seller's listings.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-09-03)
 *
 * There was no way to create a product. Nothing in the codebase
 * inserted into `products`. Everything downstream was built: the
 * admin approve-or-reject queue at /admin/marketplace reads real
 * rows, /store renders `status = "active"`, orders reference products
 * by id, and the seller application flow gates on isApprovedSeller.
 * The step where a seller lists something was missing, so the review
 * queue and the store could only ever be empty.
 *
 * Status is the spine of this page, because it is the thing a seller
 * will otherwise ask about. Draft is theirs, pending review is with an
 * admin, active is on the store, rejected comes back with a note, and
 * archived is off the store but still attached to past orders.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  getProductsForSeller,
  isApprovedSeller,
  safely,
  storeCategoryReader,
} from "@/lib/readers";
import {
  archiveProduct,
  createProduct,
  relistProduct,
  updateProduct,
} from "@/lib/product-actions";
import {
  MARKETPLACE_CATEGORY_LABELS,
  type MarketplaceCategory,
  type Product,
  type ProductStatus,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const VERTICALS: MarketplaceCategory[] = [
  "goods",
  "saas",
  "energy",
  "creative-services",
  "clothing",
];

const STATUS_COPY: Record<ProductStatus, { label: string; note: string }> = {
  draft: {
    label: "Draft",
    note: "Only you can see this. Submit it when it is ready.",
  },
  pending_review: {
    label: "In review",
    note: "With an admin. It goes on the store once approved.",
  },
  active: {
    label: "On the store",
    note: "Live and buyable. Editing sends it back for review.",
  },
  rejected: {
    label: "Needs changes",
    note: "Not on the store. See the admin note, fix it, resubmit.",
  },
  archived: {
    label: "Archived",
    note: "Off the store. Past orders still show it.",
  },
};

const INPUT =
  "w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm";
const LABEL = "block text-xs uppercase tracking-wider text-ink-muted";
const PRIMARY =
  "rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-white hover:opacity-90";
const QUIET =
  "rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-sm hover:border-brand-magenta hover:text-brand-magentaText";

export default async function SellerProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const approved = await safely(() => isApprovedSeller(user.id), false);

  const [listings, categories] = await Promise.all([
    safely(() => getProductsForSeller(user.id), []),
    safely(() => storeCategoryReader.all(), []),
  ]);

  const activeCategories = categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (!approved) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <CardEyebrow>Marketplace</CardEyebrow>
        <CardTitle className="mt-1">Your listings</CardTitle>
        <Card className="mt-6">
          <p className="text-sm text-ink-muted">
            Selling opens once your seller application is approved. An
            admin reviews these, and it takes about 48 hours.
          </p>
          <Link href="/profile/seller" className={`${QUIET} mt-4 inline-block`}>
            Apply to sell
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Marketplace</CardEyebrow>
      <CardTitle className="mt-1">Your listings</CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        85% of every sale routes to you. 12% ops, 1.5% Treasury, 1.5%
        Liquidity Pool. Listings go through admin review before they
        reach the store.
      </p>

      {listings.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-muted">
            Nothing listed yet. The form below is where a product starts.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {listings.map((p) => (
            <ListingCard key={p.id} product={p} verticals={VERTICALS} />
          ))}
        </div>
      )}

      <Card className="mt-10">
        <CardEyebrow>List something</CardEyebrow>
        <form action={createProduct} className="mt-4 space-y-4">
          <ProductFields verticals={VERTICALS} />

          {activeCategories.length > 0 && (
            <label className="block">
              <span className={LABEL}>
                Browse categories (comma separated slugs)
              </span>
              <input name="categorySlugs" className={`mt-1 ${INPUT}`} />
              <span className="mt-1 block text-[11px] text-ink-faint">
                Available: {activeCategories.map((c) => c.slug).join(", ")}
              </span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <SubmitButton
              name="submit"
              value="review"
              className={PRIMARY}
              pendingLabel="Submitting…"
            >
              Submit for review
            </SubmitButton>
            <SubmitButton
              name="submit"
              value="draft"
              className={QUIET}
              pendingLabel="Saving…"
            >
              Save as draft
            </SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ProductFields({
  verticals,
  product,
}: {
  verticals: MarketplaceCategory[];
  product?: Product;
}) {
  return (
    <>
      <label className="block">
        <span className={LABEL}>Title</span>
        <input
          name="title"
          required
          defaultValue={product?.title ?? ""}
          className={`mt-1 ${INPUT}`}
        />
      </label>

      <label className="block">
        <span className={LABEL}>Description</span>
        <textarea
          name="description"
          rows={4}
          required
          minLength={30}
          defaultValue={product?.description ?? ""}
          className={`mt-1 ${INPUT}`}
        />
        <span className="mt-1 block text-[11px] text-ink-faint">
          At least 30 characters. This is what a buyer decides on.
        </span>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className={LABEL}>Category</span>
          <select
            name="category"
            defaultValue={product?.category ?? "goods"}
            className={`mt-1 ${INPUT}`}
          >
            {verticals.map((v) => (
              <option key={v} value={v}>
                {MARKETPLACE_CATEGORY_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={LABEL}>Price (USD)</span>
          <input
            name="price"
            required
            inputMode="decimal"
            placeholder="49.99"
            defaultValue={product?.price ?? ""}
            className={`mt-1 ${INPUT}`}
          />
        </label>

        <label className="block">
          <span className={LABEL}>Inventory</span>
          <input
            name="inventoryCount"
            inputMode="numeric"
            defaultValue={product?.inventoryCount ?? ""}
            className={`mt-1 ${INPUT}`}
          />
          <span className="mt-1 block text-[11px] text-ink-faint">
            Leave blank for services and digital goods.
          </span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Tags (comma separated)</span>
          <input
            name="tags"
            defaultValue={product?.tags.join(", ") ?? ""}
            className={`mt-1 ${INPUT}`}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Image URLs (comma separated)</span>
          <input
            name="imageUrls"
            defaultValue={product?.imageUrls.join(", ") ?? ""}
            className={`mt-1 ${INPUT}`}
          />
        </label>
      </div>
    </>
  );
}

function ListingCard({
  product,
  verticals,
}: {
  product: Product;
  verticals: MarketplaceCategory[];
}) {
  const status = STATUS_COPY[product.status];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{product.title}</p>
          <p className="mt-1 text-sm text-ink-muted">
            ${product.price} ·{" "}
            {MARKETPLACE_CATEGORY_LABELS[product.category]}
            {product.inventoryCount != null &&
              ` · ${product.inventoryCount} in stock`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs text-ink-muted">
            {status.label}
          </span>
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-faint">{status.note}</p>

      {product.adminNote && (
        <p className="mt-3 rounded-lg bg-[var(--surface-inset)] p-3 text-sm text-ink-muted">
          <span className="font-medium">Admin note:</span> {product.adminNote}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {product.status === "archived" ? (
          <form action={relistProduct}>
            <input type="hidden" name="id" value={product.id} />
            <SubmitButton className={QUIET} pendingLabel="Relisting…">
              Relist
            </SubmitButton>
          </form>
        ) : (
          <form action={archiveProduct}>
            <input type="hidden" name="id" value={product.id} />
            <SubmitButton className={QUIET} pendingLabel="Archiving…">
              Take off the store
            </SubmitButton>
          </form>
        )}
      </div>

      <details className="mt-4 border-t border-[var(--surface-border)] pt-4">
        <summary className="cursor-pointer text-sm text-ink-muted hover:text-brand-magentaText">
          Edit this listing
        </summary>
        <form action={updateProduct} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={product.id} />
          <ProductFields verticals={verticals} product={product} />
          <label className="block">
            <span className={LABEL}>
              Browse categories (comma separated slugs)
            </span>
            <input
              name="categorySlugs"
              defaultValue={product.categorySlugs.join(", ")}
              className={`mt-1 ${INPUT}`}
            />
          </label>
          <p className="text-xs text-ink-faint">
            Saving sends the listing back for review, including one that
            is already on the store.
          </p>
          <SubmitButton className={PRIMARY} pendingLabel="Saving…">
            Save and resubmit
          </SubmitButton>
        </form>
      </details>
    </Card>
  );
}
