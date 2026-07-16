/**
 * Showcase — featured portfolio items across the cooperative.
 * Public-facing — only items that have been admin-published appear.
 * Redacted fields (overridden title/description, hidden projectUrl) are
 * resolved by `publicPortfolioView()` before render.
 *
 * `?pillar=stem|creative-media|professional-services` narrows the feed
 * to one pillar. The locker's pillar group links into here so the
 * "see work samples for STEM" path is one click from /locker.
 */
import Link from "next/link";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { publicProfileEligible } from "@/lib/profile-visibility";
import {
  INDUSTRY_LABELS,
  type Industry,
  publicName,
  publicPortfolioView,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

const PILLAR_ORDER: Industry[] = ["stem", "creative-media", "professional-services"];

function parsePillar(raw: string | undefined): Industry | null {
  if (!raw) return null;
  return PILLAR_ORDER.includes(raw as Industry) ? (raw as Industry) : null;
}

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ pillar?: string }>;
}) {
  const { pillar: raw } = await searchParams;
  const activePillar = parsePillar(raw);

  // Visibility-gate the portfolio entries: only items owned by public-
  // discovery-eligible users (Members + currently-recognized Partners)
  // surface here. Partner items without active recognition stay link-
  // only via their direct `/u/[handle]` URL. See `profile-visibility.ts`.
  const eligibleUserIds = new Set(
    MOCK_USERS.filter((u) => publicProfileEligible(u)).map((u) => u.id),
  );
  const published = MOCK_PORTFOLIO
    .filter((p) => eligibleUserIds.has(p.userId))
    .map(publicPortfolioView)
    .filter((x): x is NonNullable<ReturnType<typeof publicPortfolioView>> => x !== null);
  const inScope = activePillar
    ? published.filter((p) => p.industry === activePillar)
    : published;
  const featured = inScope.filter((p) => p.featured);
  const rest = inScope.filter((p) => !p.featured);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Showcase</h1>
      <p className="mt-2 text-ink-muted">
        {activePillar
          ? `Work from the cooperative · ${INDUSTRY_LABELS[activePillar]}.`
          : "Work from the cooperative."}
      </p>

      <PillarFilter active={activePillar} />

      <Section title="Featured">
        {featured.length === 0 ? <Empty pillar={activePillar} /> : <Grid items={featured} />}
      </Section>

      {rest.length > 0 && (
        <Section title="More">
          <Grid items={rest} />
        </Section>
      )}
    </div>
  );
}

function PillarFilter({ active }: { active: Industry | null }) {
  const pill = (label: string, target: Industry | null) => {
    const isActive = active === target;
    const href = target ? `/showcase?pillar=${target}` : "/showcase";
    return (
      <Link
        key={target ?? "all"}
        href={href}
        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
          isActive
            ? "border-brand-magenta bg-brand-magenta text-brand-white"
            : "border-[var(--surface-border)] text-ink-muted hover:bg-[var(--surface-inset)]"
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="mr-2 text-[11px] uppercase tracking-wider text-ink-faint">
        Pillar
      </span>
      {pill("All", null)}
      {PILLAR_ORDER.map((p) => pill(INDUSTRY_LABELS[p], p))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ pillar }: { pillar: Industry | null }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
      {pillar
        ? `No published ${INDUSTRY_LABELS[pillar]} work yet.`
        : "No published work yet."}
    </div>
  );
}

type PublicItem = NonNullable<ReturnType<typeof publicPortfolioView>>;

function Grid({ items }: { items: PublicItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const author = MOCK_USERS.find((u) => u.id === item.userId);
        const authorName = publicName(author);
        return (
          <Card key={item.id}>
            <CardEyebrow>{INDUSTRY_LABELS[item.industry]}</CardEyebrow>
            <CardTitle className="mt-2">{item.title}</CardTitle>
            <p className="mt-3 text-sm text-ink-muted">{item.description ?? ""}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.technologies.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              {author ? (
                <Link
                  href={`/u/${author.handle}`}
                  className="flex items-center gap-2 text-xs text-ink-faint hover:text-ink"
                >
                  <Avatar user={author} size="xs" />
                  <span>By {authorName}</span>
                </Link>
              ) : (
                <span className="text-xs text-ink-faint">By {authorName}</span>
              )}
              {item.projectUrl && (
                <a
                  href={item.projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs hover:underline"
                  style={{ color: "#D828A0" }}
                >
                  View →
                </a>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
