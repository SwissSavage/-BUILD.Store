import Link from "next/link";

export function OpportunityHeader({
  backHref,
  backLabel,
  imageUrl,
  kind,
  industry,
  title,
  postedAt,
  trailing,
}: {
  backHref: string;
  backLabel: string;
  imageUrl?: string | null;
  kind: string;
  industry: string;
  title: string;
  postedAt?: string | null;
  trailing?: React.ReactNode;
}) {
  const tags = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-[rgba(80,112,240,0.18)] px-2.5 py-0.5 text-xs font-medium text-[var(--fm-blue-text)]">
        {kind}
      </span>
      <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        {industry}
      </span>
    </div>
  );
  const byline = postedAt ? (
    <p className="mt-3 text-sm text-ink-muted">
      Posted by Future Modern · {new Date(postedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}
    </p>
  ) : null;

  return (
    <>
      <Link href={backHref} className="text-sm text-ink-muted hover:text-ink">
        ← {backLabel}
      </Link>
      {imageUrl ? (
        <div className="relative mt-4 min-h-[22rem] overflow-hidden rounded-2xl bg-[var(--surface-elevated)]">
          {/* A remote image stays optional; pages without one retain the normal header. */}
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
          <div className="relative flex min-h-[22rem] flex-col justify-end p-6 sm:p-10">
            <div className="[&_*]:!text-white">{tags}</div>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold text-white sm:text-5xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="[&_*]:!text-white/80">{byline}</div>
              {trailing}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {tags}
            <h1 className="mt-2 font-display text-4xl font-semibold">{title}</h1>
            {byline}
          </div>
          {trailing}
        </div>
      )}
    </>
  );
}
