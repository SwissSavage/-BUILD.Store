/**
 * Store nav dropdown. Lists active StoreCategories.
 *
 * Native <details>/<summary> so it works without client JS, matching
 * the Admin dropdown pattern. The categories themselves come from
 * `mock-data/store-categories.activeCategories()`, which will become
 * a Drizzle query or Payload fetch once CMS lands.
 *
 * The "All" entry at the top routes to /store with no filter; each
 * category routes to /store?category=<slug>.
 */
import Link from "next/link";
import { activeCategories } from "@/lib/mock-data/store-categories";
import { cn } from "@/lib/cn";

const navLink = "text-ink-muted hover:text-ink transition-colors";

export function StoreDropdown() {
  const categories = activeCategories();

  return (
    <details className="relative">
      <summary
        className={cn(
          navLink,
          "flex cursor-pointer list-none items-center gap-1 select-none hover:opacity-80",
        )}
      >
        Store
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-2 text-sm shadow-lg">
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
      </div>
    </details>
  );
}
