/**
 * A block of your own profile, presented, with the form one click away.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * Jamar, twice: "I hate this in page editing layout... The front page
 * of the profile should be where information is presented, not
 * altered." Then, after the first attempt turned /profile into a page
 * of summary cards that linked out to /profile/edit/<section>: "I also
 * still don't like the profile solution. When you get on facebook, you
 * just see your profile and there are fields you can edit. Viewing
 * your profile should be what you see when you click your profile, not
 * a secondary option."
 *
 * Both attempts missed the same way. The first put you in a settings
 * screen. The second put your profile one navigation behind a menu.
 * What he described is neither: the profile IS the page, and editing
 * happens on the thing you are looking at.
 *
 * So this renders the value, with an Edit control beside the label.
 * Opening it swaps the value for the form in place, in the same box,
 * at the same size. Closing it puts the value back.
 *
 * Built on <details>, which means no client JavaScript, no state, and
 * it works before hydration. The swap is one CSS sibling rule in
 * globals.css (`.fm-editable[open] ~ .fm-editable-view`) rather than a
 * conditional render, because a conditional render needs state and
 * state here needs a client component around every field on the page.
 * ─────────────────────────────────────────────────────────────
 */
import { cn } from "@/lib/cn";

export function EditableBlock({
  label,
  hint,
  form,
  children,
  saved = false,
  className,
}: {
  /** Section name, shown as the eyebrow. */
  label: string;
  /** Optional one-liner under the label, always visible. */
  hint?: string;
  /** The edit form. Rendered only when the block is opened. */
  form: React.ReactNode;
  /** The value, as presented. Hidden while the form is open. */
  children: React.ReactNode;
  /** True on the block that was just written, from ?saved= */
  saved?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6",
        className,
      )}
    >
      <details className="fm-editable group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-brand-magentaText">
              {label}
            </span>
            {saved && (
              <span className="rounded-full bg-brand-magenta/15 px-2 py-0.5 text-[11px] text-brand-magentaText">
                Saved
              </span>
            )}
          </span>
          <span className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs text-ink-muted group-hover:border-brand-magenta group-hover:text-brand-magentaText">
            {/* Swaps label with the block's open state, so the control
                always says what the next click does. */}
            <span className="group-open:hidden">Edit</span>
            <span className="hidden group-open:inline">Close</span>
          </span>
        </summary>
        <div className="mt-4">{form}</div>
      </details>

      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}

      <div className="fm-editable-view mt-3">{children}</div>
    </div>
  );
}

/** Shown in place of a value the member has not filled in yet. */
export function EmptyValue({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-ink-faint">{children}</p>;
}
