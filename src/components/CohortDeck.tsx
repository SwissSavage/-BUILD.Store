import { TradingCard, type TradingCardTier } from "@/components/TradingCard";
import type { MembershipTier } from "@/lib/types";
import { CalendarDays } from "lucide-react";

type CohortBuilder = {
  id: string;
  href: string;
  name: string;
  label: string;
  joinedLabel: string;
  joinedAriaLabel: string;
  membershipTier: MembershipTier;
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

const MEMBERSHIP_RAIL_MINIMUM = 20;

/**
 * A complete, moving roster rather than a capped showcase. Before Future
 * Modern has enough depth, the rails show the newest and earlier halves. Once
 * both public Members and Partners reach twenty, they become separate rails.
 */
export function CohortDeck({ builders }: { builders: CohortBuilder[] }) {
  const members = builders.filter(
    (builder) => builder.membershipTier === "member",
  );
  const partners = builders.filter(
    (builder) => builder.membershipTier === "partner",
  );
  const hasSeparateMembershipRails =
    members.length >= MEMBERSHIP_RAIL_MINIMUM &&
    partners.length >= MEMBERSHIP_RAIL_MINIMUM;

  // `builders` arrives newest-first. Give an odd builder to the newest rail
  // until both membership groups are substantial enough to stand alone.
  const splitIndex = Math.ceil(builders.length / 2);
  const topBuilders = hasSeparateMembershipRails
    ? partners
    : builders.slice(0, splitIndex);
  const bottomBuilders = hasSeparateMembershipRails
    ? members
    : builders.slice(splitIndex);

  return (
    <div className="mt-10 space-y-6 overflow-hidden py-2 md:space-y-7">
      <BuilderRail builders={topBuilders} direction="right" />
      {bottomBuilders.length > 0 && (
        <BuilderRail builders={bottomBuilders} direction="left" />
      )}
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
    <div className="cohort-builder-rail overflow-hidden py-2">
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
          <p className="flex items-center gap-1 text-[10px] font-medium text-white/65">
            <CalendarDays aria-hidden="true" size={12} strokeWidth={1.75} />
            <span aria-hidden="true">{builder.joinedLabel}</span>
            <span className="sr-only">{builder.joinedAriaLabel}</span>
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
