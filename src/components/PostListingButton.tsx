/**
 * Admin "post one" affordance for listing pages.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-01)
 *
 * Every create path lived in the admin console and nowhere else. So
 * an admin standing on /contracts looking at "No open contracts right
 * now" had no way to post one from that page — the action was three
 * clicks away behind a tile in a grid of two dozen, and the empty
 * state didn't mention it.
 *
 * The place you notice a listing is missing is the listing page. That
 * is where the button goes.
 * ─────────────────────────────────────────────────────────────
 *
 * Renders nothing for non-admins, so it can be dropped onto public
 * surfaces without gating each call site.
 */
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";

interface PostListingButtonProps {
  href: string;
  label: string;
  /** Shown under the button on empty states. */
  hint?: string;
  /** Center it and add breathing room — for use inside an empty state. */
  standalone?: boolean;
}

export async function PostListingButton({
  href,
  label,
  hint,
  standalone = false,
}: PostListingButtonProps) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;

  return (
    <div className={standalone ? "mt-6 text-center" : ""}>
      <Link
        href={href}
        className="inline-block rounded-full bg-brand-magenta px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        {label}
      </Link>
      {hint && (
        <p className="mt-2 text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  );
}
