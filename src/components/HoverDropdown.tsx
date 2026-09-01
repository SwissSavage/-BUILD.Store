/**
 * Nav dropdown that opens on hover.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS REPLACED <details> (2026-08-31)
 *
 * Every nav dropdown was a native `<details>`/`<summary>`. That works
 * without client JS, which was the original appeal, but it has one
 * behaviour that made the nav genuinely annoying: each `<details>` is
 * independent, so opening a second one leaves the first open. Panels
 * accumulated and stayed open until you clicked each summary again.
 *
 * This is pure CSS — a `group` wrapper and `group-hover` on the panel.
 * Nothing holds open state, so nothing can be left open. Moving the
 * pointer to another nav item closes the previous panel because it
 * simply stops being hovered. No client JS, no `"use client"`.
 * ─────────────────────────────────────────────────────────────
 *
 * The panel sits in a wrapper with no vertical gap to the trigger —
 * `pt-2` on the panel provides the visual offset instead of `mt-2`, so
 * the pointer never crosses dead space on its way down and the menu
 * doesn't flicker shut mid-travel.
 *
 * Touch: hover doesn't fire on touch devices, so the trigger is also a
 * link to `href` when one is given, and the whole nav is replaced by
 * MobileMenu below the `md` breakpoint anyway.
 */
import Link from "next/link";
import { cn } from "@/lib/cn";

interface HoverDropdownProps {
  /** Trigger text. */
  label: React.ReactNode;
  /** Where the trigger itself navigates — the touch fallback. */
  href?: string;
  /** Panel width class, e.g. "w-72". */
  width?: string;
  /** Extra classes on the trigger. */
  triggerClassName?: string;
  /** Inline style on the trigger (the Admin entry is magenta). */
  triggerStyle?: React.CSSProperties;
  /** Align the panel to the left edge of the trigger instead of right. */
  alignLeft?: boolean;
  children: React.ReactNode;
}

export function HoverDropdown({
  label,
  href,
  width = "w-64",
  triggerClassName,
  triggerStyle,
  alignLeft = false,
  children,
}: HoverDropdownProps) {
  const trigger = (
    <span
      className={cn(
        "flex cursor-pointer list-none items-center gap-1 select-none",
        triggerClassName,
      )}
      style={triggerStyle}
    >
      {label}
      <span aria-hidden="true" className="text-[10px]">
        ▾
      </span>
    </span>
  );

  return (
    <div className="group relative">
      {href ? (
        <Link href={href} className="block">
          {trigger}
        </Link>
      ) : (
        trigger
      )}

      {/* Hidden until the wrapper is hovered or something inside it
          takes focus — focus-within is what keeps the menu reachable
          by keyboard, since there's no click target to toggle. */}
      <div
        className={cn(
          "invisible absolute z-50 pt-2 opacity-0 transition-opacity duration-100",
          "group-hover:visible group-hover:opacity-100",
          "group-focus-within:visible group-focus-within:opacity-100",
          alignLeft ? "left-0" : "right-0",
          width,
        )}
      >
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-2 text-sm shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
