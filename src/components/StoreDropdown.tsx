/**
 * Store nav dropdown. Lists active StoreCategories.
 *
 * Opens on hover via the shared HoverDropdown. Categories read live
 * from `store_categories`.
 *
 * The "All" entry at the top routes to /store with no filter; each
 * category routes to /store?category=<slug>.
 */
import Link from "next/link";
import { storeCategoryReader, safely } from "@/lib/readers";
import { HoverDropdown } from "@/components/HoverDropdown";

const navLink = "text-ink-muted hover:text-ink transition-colors";

export async function StoreDropdown() {
  const all = await safely(() => storeCategoryReader.all(), []);
  const categories = all
    .filter((c) => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <HoverDropdown label="Store" href="/store" triggerClassName={navLink}>
        <Link
          href="/store"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          <span className="font-medium">All listings</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-faint">
            Browse everything
          </span>
        </Link>
        <div className="my-1 border-t border-[var(--surface-border)]" />
        {categories.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-ink-faint">
            No categories yet.
          </p>
        ) : (
          categories.map((c) => (
            <Link
              key={c.id}
              href={`/store?category=${c.slug}`}
              className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
            >
              <span className="font-medium">{c.name}</span>
              {c.description && (
                <span className="mt-0.5 block text-[11px] text-ink-faint">
                  {c.description}
                </span>
              )}
            </Link>
          ))
        )}
    </HoverDropdown>
  );
}
