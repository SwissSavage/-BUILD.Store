/**
 * Marketplace browse surface (Phase 2.1 sandbox preview).
 *
 * Filtered view over MOCK_PRODUCTS keyed by `categorySlugs`. The user-
 * facing taxonomy comes from `MOCK_STORE_CATEGORIES` (CMS-editable —
 * see `src/lib/mock-data/store-categories.ts`).
 *
 * The legacy `MarketplaceCategory` enum (goods / saas / energy /
 * creative-services / clothing) stays on Product as `category` and
 * powers subdomain routing in production via middleware. It's NOT the
 * user-facing taxonomy any more — that's `categorySlugs` against the
 * StoreCategory collection.
 *
 * REPLACE WITH: Drizzle query with status='active' + categorySlugs array
 * containment, pagination, search index.
 */
import Link from "next/link";
import { MOCK_PRODUCTS } from "@/lib/mock-data/products";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  activeCategories,
  activeCategoryBySlug,
} from "@/lib/mock-data/store-categories";
import {
  publicName,
  userPillars,
  INDUSTRY_LABELS,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const activeCategory = categoryParam
    ? activeCategoryBySlug(categoryParam)
    : null;
  const categories = activeCategories();

  const products = MOCK_PRODUCTS.filter(
    (p) =>
      p.status === "active" &&
      (!activeCategory || p.categorySlugs.includes(activeCategory.slug)),
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <header>
        <div className="text-xs uppercase tracking-wider text-brand-magenta">
          $BUILD.Store marketplace
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          {activeCategory ? activeCategory.name : "The cooperative store"}
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          {activeCategory?.description ??
            "Products from vetted Future Modern members. Every listing contributes 15% back to the cooperative; 85% routes to the seller."}
        </p>
      </header>

      {/* Category filter — same source as the nav dropdown. */}
      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/store"
          className={`rounded-full border px-3 py-1.5 text-xs ${
            activeCategory === null
              ? "border-transparent text-white"
              : "border-[var(--surface-border)] hover:bg-[var(--surface-inset)]"
          }`}
          style={
            activeCategory === null ? { backgroundColor: "#D828A0" } : undefined
          }
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/store?category=${c.slug}`}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              activeCategory?.id === c.id
                ? "border-transparent text-white"
                : "border-[var(--surface-border)] hover:bg-[var(--surface-inset)]"
            }`}
            style={
              activeCategory?.id === c.id
                ? { backgroundColor: "#D828A0" }
                : undefined
            }
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {/* Product grid */}
      {products.length === 0 ? (
        <Card className="mt-10">
          <p className="text-sm text-ink-muted">
            {activeCategory
              ? `No active listings in ${activeCategory.name} yet. Check back once more sellers are vetted.`
              : "No active listings yet. Check back once more sellers are vetted."}
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const seller = MOCK_USERS.find((u) => u.id === p.sellerId);
            const pillars = seller ? userPillars(seller) : [];
            return (
              <Link key={p.id} href={`/store/${p.id}`} className="block">
                <Card className="transition-colors hover:border-brand-magenta">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardEyebrow>
                        {p.categorySlugs
                          .map((s) => activeCategoryBySlug(s)?.name)
                          .filter(Boolean)
                          .join(" · ") || "Uncategorized"}
                      </CardEyebrow>
                      <CardTitle className="mt-1">{p.title}</CardTitle>
                    </div>
                    <div
                      className="shrink-0 font-display text-xl font-semibold"
                      style={{ color: "#D828A0" }}
                    >
                      ${Number(p.price).toLocaleString()}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted">{p.description}</p>

                  <div className="mt-4 flex flex-wrap gap-1">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] text-ink-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--surface-border)] pt-4 text-xs text-ink-faint">
                    <span>
                      From {seller ? publicName(seller) : "a cooperative member"}
                      {pillars.length > 0 && (
                        <>
                          {" · "}
                          <span>
                            {pillars
                              .map((pl) => INDUSTRY_LABELS[pl])
                              .join(" + ")}
                          </span>
                        </>
                      )}
                    </span>
                    {p.inventoryCount !== null && (
                      <span>
                        {p.inventoryCount > 0
                          ? `${p.inventoryCount} in stock`
                          : "Sold out"}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card className="mt-12">
        <CardEyebrow>Want to sell on the cooperative store?</CardEyebrow>
        <CardTitle className="mt-2">Vetting required</CardTitle>
        <p className="mt-3 text-sm text-ink-muted">
          Marketplace access goes to approved members. Admin reviews your
          categories, fulfillment plan, and any provenance requirements
          before your first listing goes live.
        </p>
        <Link
          href="/profile/seller"
          className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Apply for marketplace access →
        </Link>
      </Card>
    </div>
  );
}
