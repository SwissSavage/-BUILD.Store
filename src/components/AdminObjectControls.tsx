/**
 * Admin controls for the thing you are currently looking at.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Every admin capability lived inside /admin. Editing a contract meant
 * knowing that /admin/projects existed; removing one meant knowing
 * about /admin/trash. Standing on the contract itself, there was no
 * indication either was possible.
 *
 * Jamar, twice in one week: "Where am I supposed to be seeing an option
 * to add contracts etc. through the app?" and then "I still don't see a
 * way or an option to edit, or delete the test proposal. Or any jobs,
 * contracts, or projects."
 *
 * The capability existed both times. The affordance did not. The place
 * you notice a listing is wrong is the listing.
 * ─────────────────────────────────────────────────────────────
 *
 * Renders nothing for non-admins, so it can sit on public pages
 * without gating each call site.
 */
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";

interface Props {
  /** Where the edit form lives. */
  editHref: string;
  /** Where the remove/trash control lives. Omit if not removable. */
  trashHref?: string;
  /** What is being administered, for the label. */
  label?: string;
}

export async function AdminObjectControls({
  editHref,
  trashHref,
  label = "listing",
}: Props) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-inset)] px-4 py-3">
      <span className="text-xs uppercase tracking-wider text-ink-faint">
        Admin
      </span>
      <Link
        href={editHref}
        className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-sm hover:border-brand-magenta hover:text-brand-magentaText"
      >
        Edit {label}
      </Link>
      {trashHref && (
        <Link
          href={trashHref}
          className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-sm hover:border-brand-magenta hover:text-brand-magentaText"
        >
          Move to trash
        </Link>
      )}
      <span className="text-xs text-ink-faint">
        Only you can see this row.
      </span>
    </div>
  );
}
