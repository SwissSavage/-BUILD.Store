/**
 * Jobs nav dropdown. Consolidates the three related surfaces —
 * public Listings (/jobs), Contracts (/contracts), and Projects
 * (/projects) — under one nav entry so the header row stays
 * scannable (Rob beta note #1, task #59).
 *
 * Opens on hover via the shared HoverDropdown — see that file for why
 * the native <details> pattern was dropped (panels stayed open when
 * you moved to another nav item).
 */
import Link from "next/link";
import { HoverDropdown } from "@/components/HoverDropdown";

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
    blurb: "Active builds recruiting contributors.",
  },
  {
    href: "/case-studies",
    label: "Case studies",
    blurb: "Completed contracts delivered through the cooperative.",
  },
];

export function JobsDropdown() {
  return (
    <HoverDropdown label="Jobs" href="/jobs" triggerClassName={navLink}>
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
    </HoverDropdown>
  );
}
