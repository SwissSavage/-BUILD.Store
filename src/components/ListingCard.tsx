/**
 * The one card every listing board uses: contracts, projects, jobs, store.
 *
 * Fixed 16:9 image slot on top so a card without an image keeps the same
 * shape as one with. Body grows, footer pins to the bottom, so cards in a
 * grid row end level (the grid stretches the link, `h-full` carries it).
 */
import Link from "next/link";
import { cn } from "@/lib/cn";

export function ListingCard({
  href,
  imageUrl,
  children,
  footer,
}: {
  href: string;
  imageUrl?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const src =
    imageUrl?.trim() ||
    process.env.NEXT_PUBLIC_FALLBACK_FEATURED_IMAGE_URL?.trim() ||
    null;

  return (
    <Link href={href} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] transition-colors group-hover:border-brand-magenta/40">
        <div className="relative aspect-[16/9] overflow-hidden bg-[var(--surface)]">
          {src ? (
            // alt="" because the title right below already names the card;
            // a described image would read the title twice to screen readers.
            <img
              src={src}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div
              aria-hidden
              className="h-full w-full opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--fm-grad-from) 0%, var(--fm-grad-to) 100%)",
              }}
            />
          )}
        </div>
        <div className="flex flex-1 flex-col p-6">
          {children}
          {footer && <div className="mt-auto pt-5">{footer}</div>}
        </div>
      </article>
    </Link>
  );
}

/** Up to three tags, then "+N", so a tag-heavy listing can't stretch its card. */
export function ListingTags({
  tags,
  className,
}: {
  tags: string[];
  className?: string;
}) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, 3);
  const rest = tags.length - shown.length;
  const chip =
    "rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted";
  return (
    <div className={cn("mt-4 flex flex-wrap gap-1.5", className)}>
      {shown.map((t) => (
        <span key={t} className={chip}>
          {t}
        </span>
      ))}
      {rest > 0 && <span className={chip}>+{rest}</span>}
    </div>
  );
}
