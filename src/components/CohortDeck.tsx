import {
  TradingCard,
  type TradingCardTier,
} from "@/components/TradingCard";

type CohortBuilder = {
  id: string;
  href: string;
  name: string;
  label: string;
  joinedLabel: string;
  tier: TradingCardTier;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    handle: string;
    profileImageUrl: string | null;
    avatarPortraitUrl: string | null;
  };
};

/**
 * The homepage is a living joiner feed. It remains a complete roster rather
 * than a curated subset: newest builders lead and every eligible person has a
 * card in the same responsive layout.
 */
export function CohortDeck({
  builders,
  leadLabel,
}: {
  builders: CohortBuilder[];
  leadLabel: string;
}) {
  return (
    <div className="mt-10">
      <p className="mb-5 text-sm text-ink-muted">
        {builders.length} {builders.length === 1 ? "builder" : "builders"} — newest first.
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6">
        {builders.map((builder, index) => (
          <li
            key={builder.id}
            className={index === 0 ? "sm:col-span-1" : undefined}
          >
            <TradingCard
              user={builder.user}
              href={builder.href}
              tier={builder.tier}
              aspectRatio="3/4"
              className="transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="mt-auto">
                <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                  {index === 0 ? leadLabel : builder.joinedLabel}
                </p>
                <h3 className="mt-1 font-display text-base font-semibold text-white sm:text-xl">
                  {builder.name}
                </h3>
                <p className="mt-1 text-xs text-white/75 sm:text-sm">{builder.label}</p>
              </div>
            </TradingCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
