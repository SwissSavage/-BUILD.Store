/**
 * Chrome shared by every /profile/edit section route.
 *
 * The section nav used to be sticky anchors scrolling one enormous
 * column. It is now real navigation between routes, so each item is a
 * page you land on rather than a position you scroll to, and the
 * current one is marked.
 */
import Link from "next/link";

const SECTIONS = [
  { slug: "identity", label: "Identity" },
  { slug: "work", label: "Work" },
  { slug: "paperwork", label: "Paperwork" },
  { slug: "talent-tags", label: "Talent tags" },
  { slug: "portfolio", label: "Portfolio" },
  { slug: "money", label: "Money" },
  { slug: "data", label: "Data" },
] as const;

export function EditSectionFrame({
  active,
  title,
  handle,
  children,
}: {
  active: string;
  title: string;
  handle: string | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/profile" className="text-sm text-ink-muted hover:text-ink">
        ← Back to my profile
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">{title}</h1>
      {handle && (
        <p className="mt-2 text-sm text-ink-muted">
          Changes show on{" "}
          <Link
            href={`/u/${handle}`}
            className="text-brand-magenta hover:underline"
          >
            /u/{handle}
          </Link>
          .
        </p>
      )}

      <nav
        aria-label="Profile sections"
        className="mt-6 border-y border-[var(--surface-border)] py-2"
      >
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {SECTIONS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/profile/edit/${s.slug}`}
                aria-current={s.slug === active ? "page" : undefined}
                className={
                  s.slug === active
                    ? "text-brand-magenta"
                    : "text-ink-muted hover:text-brand-magenta"
                }
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
