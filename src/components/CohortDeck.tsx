import { TradingCard, type TradingCardTier } from "@/components/TradingCard";

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

type RailDirection = "left" | "right";

/**
 * A complete, moving roster rather than a capped showcase. The two opposing
 * tracks retain the newest-first source order and let the roster feel alive
 * without turning the cards into a pager visitors have to operate.
 */
export function CohortDeck({ builders }: { builders: CohortBuilder[] }) {
  return (
    <div className="mt-10 space-y-6 overflow-hidden md:space-y-7">
      <BuilderRail builders={builders} direction="right" />
      <BuilderRail builders={builders} direction="left" />
    </div>
  );
}

function BuilderRail({
  builders,
  direction,
}: {
  builders: CohortBuilder[];
  direction: RailDirection;
}) {
  const durationSeconds = Math.max(30, builders.length * 5);

  return (
    <div className="cohort-builder-rail overflow-hidden">
      <div
        className={`cohort-builder-track flex w-max ${
          direction === "right" ? "cohort-builder-track--right" : ""
        }`}
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        <ul className="flex shrink-0 gap-4 pr-4 md:gap-5 md:pr-5">
          {builders.map((builder) => (
            <BuilderCard key={builder.id} builder={builder} />
          ))}
        </ul>
        <ul
          className="flex shrink-0 gap-4 pr-4 md:gap-5 md:pr-5"
          aria-hidden="true"
        >
          {builders.map((builder) => (
            <BuilderCard key={builder.id} builder={builder} repeated />
          ))}
        </ul>
      </div>
    </div>
  );
}

function BuilderCard({
  builder,
  repeated = false,
}: {
  builder: CohortBuilder;
  repeated?: boolean;
}) {
  return (
    <li>
      <TradingCard
        user={builder.user}
        href={repeated ? undefined : builder.href}
        tier={builder.tier}
        aspectRatio="3/4"
        className="w-36 transition-transform duration-200 hover:-translate-y-1 sm:w-40 md:w-48 lg:w-52"
      >
        <div className="mt-auto">
          <p className="text-[10px] font-medium text-white/65">
            {builder.joinedLabel}
          </p>
          <h3 className="mt-1 font-display text-base font-semibold text-white sm:text-lg">
            {builder.name}
          </h3>
          <p className="mt-1 truncate text-xs text-white/75">{builder.label}</p>
        </div>
      </TradingCard>
    </li>
  );
}
