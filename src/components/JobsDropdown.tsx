/**
 * Jobs nav dropdown. Consolidates the three related surfaces —
 * public Listings (/jobs), Contracts (/contracts), and Projects
 * (/projects) — under one nav entry so the header row stays
 * scannable (Rob beta note #1, task #59).
 *
 * Same native <details>/<summary> pattern as StoreDropdown so it
 * works without client JS and matches the platform's other
 * dropdowns.
 */
import Link from "next/link";
import { cn } from "@/lib/cn";

const navLink = "text-ink-muted hover:text-ink transition-colors";

interface JobsDropdownItem {
  href: string;
  label: string;
  blurb: string;
}

const ITEMS: JobsDropdownItem[] = [
  {
    href: "/jobs",
    label: "Listings",
    blurb: "Open roles — full-time, part-time, contract-to-hire.",
  },
  {
    href: "/contracts",
    label: "Contracts",
    blurb: "Short-term gigs open for bids.",
  },
  {
    href: "/projects",
    label: "Projects",
    blurb: "Case studies + active builds recruiting contributors.",
  },
];

export function JobsDropdown() {
  return (
    <details className="relative">
      <summary
        className={cn(
          navLink,
          "flex cursor-pointer list-none items-center gap-1 select-none hover:opacity-80",
        )}
      >
        Jobs
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-2 text-sm shadow-lg">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
          >
            <span className="font-medium">{item.label}</span>
            <span className="mt-0.5 block text-[11px] text-ink-faint">
              {item.blurb}
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
