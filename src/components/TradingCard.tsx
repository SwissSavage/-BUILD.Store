/**
 * TradingCard — visual primitive for the cooperative's player-card aesthetic.
 *
 * Renders a card-shaped surface with FM brand backdrop, watermark logo,
 * and a bg-removed portrait foreground. Three visual tiers map to the
 * recognition / standing ladder:
 *
 *   - standard     : Partners, Prospects, good-standing Members. Calm
 *                    brand gradient, no animation. Already beautiful
 *                    enough to send a client.
 *   - elevated     : Future Modernist pool, promotion-eligible. Richer
 *                    gradient, slight visual lift.
 *   - holographic  : Champion's Court (top 10% Members AND OVR >= 90).
 *                    Animated conic-gradient + diagonal sheen. Real
 *                    holo-card energy without being garish.
 *
 * Graceful fallback: when `user.avatarPortraitUrl` is null, falls back to
 * the member portrait (studio shot, profile photo, or initials) rendered
 * inside the same card frame. Sandbox phase has no bg-removed portraits
 * yet — the visual lands cleanly without them and gets richer once the
 * photo pipeline is in place.
 *
 * Composition: pass `children` to layer additional content over the
 * card (e.g., MvpCard renders OVR + sub-ratings; /u/[handle] hero
 * renders name + tier badges). The card itself is the visual frame +
 * portrait + brand backdrop.
 */
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { MembershipTier, User } from "@/lib/types";

/**
 * RPG rarity ladder. Each tier maps to an OVR band (or to "no scoring"
 * for unscored Partners).
 *
 *   standard            — Partners without MVP snapshot. Calm brand
 *                          gradient over dark base. Falls outside the
 *                          rarity ladder. Still beautiful.
 *   probation           — OVR <70 (probation + removal accelerated).
 *                          Gray dominant. Common rarity.
 *   good_standing       — OVR 70-74. Green dominant. Uncommon.
 *   promotion_eligible  — OVR 75-79. Blue dominant. Rare. The 6th-man /
 *                          role-player band.
 *   future_modernist    — OVR 80-89. Magenta dominant. Epic.
 *   champion            — OVR 90+ AND in Champion's Court (top 10%).
 *                          Holographic + gold animated. Legendary.
 */
export type TradingCardTier =
  | "standard"
  | "member"
  | "probation"
  | "good_standing"
  | "promotion_eligible"
  | "future_modernist"
  | "champion";

interface TradingCardProps {
  user: Pick<
    User,
    | "id"
    | "firstName"
    | "lastName"
    | "handle"
    | "profileImageUrl"
    | "avatarPortraitUrl"
  >;
  tier?: TradingCardTier;
  /**
   * Where the card goes when clicked.
   *
   * The card is the member's profile, not a decoration beside it — so
   * wherever one appears it should be the way in. Omit only when the
   * card IS the destination (the profile page's own hero).
   */
  href?: string;
  /** Optional content composed on top of the card (name, badges, etc.). */
  children?: React.ReactNode;
  /** Width override. Default fluid. */
  className?: string;
  /** Aspect ratio of the card. Default 3/4 (taller than wide, sports-card shape). */
  aspectRatio?: "3/4" | "4/5" | "square";
}

const TIER_BG_CLASS: Record<TradingCardTier, string> = {
  standard: "fm-card-bg-standard",
  member: "fm-card-bg-member",
  probation: "fm-card-bg-probation",
  good_standing: "fm-card-bg-good-standing",
  promotion_eligible: "fm-card-bg-promotion",
  future_modernist: "fm-card-bg-future-modernist",
  champion: "fm-card-bg-champion",
};

/**
 * Tier accent, used for the initials wash and the rule under them.
 * Same hues as the borders, at full strength.
 */
/**
 * Label for the STANDING band shown on the card face.
 *
 * ─────────────────────────────────────────────────────────────
 * TWO DIFFERENT THINGS, DO NOT CONFLATE (fixed 2026-09-01)
 *
 *   membershipTier   viewer | partner | member
 *                    What you ARE in the cooperative. Set by
 *                    admission and promotion. Never derived.
 *
 *   TradingCardTier  standard | probation | good_standing |
 *                    promotion_eligible | future_modernist | champion
 *                    How you are CURRENTLY PERFORMING. Derived from
 *                    the MVP snapshot on every recompute.
 *
 * They are orthogonal. A Member with no published snapshot is tier
 * `standard`; so is a Partner. A Member on probation is still a
 * Member. Promotion between membership tiers is an admin decision on
 * /admin/members/[id], not a consequence of an OVR crossing a line —
 * `promotion_eligible` says the standing supports a case for it,
 * nothing more.
 *
 * This map used to render `standard` as "Partner", which put a
 * membership word on a standing band. Jamar, a Member with no
 * published snapshot, read "Partner" on his own card. The tier was
 * right; the label was answering a different question.
 * ─────────────────────────────────────────────────────────────
 */
export const CARD_TIER_LABEL: Record<TradingCardTier, string> = {
  standard: "Unrated",
  member: "Member",
  probation: "Probation",
  good_standing: "Good standing",
  promotion_eligible: "Promotion eligible",
  future_modernist: "Future Modernist",
  champion: "Champion's Court",
};

const TIER_ACCENT: Record<TradingCardTier, string> = {
  standard: "#8a8780",
  member: "#c7228a",
  probation: "#A3A3A3",
  good_standing: "#017249",
  promotion_eligible: "#3A4FAA",
  future_modernist: "#c7228a",
  champion: "#D4AF37",
};

const TIER_BORDER: Record<TradingCardTier, string> = {
  standard: "var(--surface-border)",
  member: "rgba(199, 34, 138, 0.45)",
  probation: "rgba(102, 102, 102, 0.5)",
  good_standing: "rgba(0, 112, 72, 0.6)",
  promotion_eligible: "rgba(80, 112, 240, 0.6)",
  future_modernist: "rgba(216, 40, 160, 0.65)",
  champion: "rgba(212, 175, 55, 0.75)", // gold
};

export function TradingCard({
  user,
  tier = "standard",
  children,
  href,
  className,
  aspectRatio = "3/4",
}: TradingCardProps) {
  // Jersey-style initials for the no-portrait state.
  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    (user.handle?.[0]?.toUpperCase() ?? "FM");

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "4/5"
        ? "aspect-[4/5]"
        : "aspect-[3/4]";

  const card = (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border bg-[var(--surface-elevated)]",
        // @container so the initials scale with the card, not the
        // viewport — these render at wildly different sizes on the
        // homepage rail versus a profile page.
        "[container-type:inline-size]",
        aspectClass,
        className,
      )}
      style={{ borderColor: TIER_BORDER[tier] }}
    >
      {/* Backdrop layer */}
      <div
        className={cn("absolute inset-0", TIER_BG_CLASS[tier])}
        aria-hidden
      />

      {/* FM logo watermark — top-right corner, faint */}
      <div
        className="pointer-events-none absolute right-4 top-4 select-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/40"
        aria-hidden
      >
        Future Modern
      </div>

      {/* Portrait foreground.
          
          Three states, in descending order of how much we have:
          
          1. A bg-removed studio portrait — the intended treatment.
          2. A profile photo — filled to the card and faded into it
             from below, so it reads as the card's image rather than
             an avatar someone dropped on top.
          3. Neither — oversized initials as the graphic, jersey-style.
          
          State 3 used to be a size="xl" Avatar: a small circle
          floating at the bottom of an otherwise empty card. Since
          nobody has a studio portrait yet, that was what every card
          actually looked like. Initials at least fill the space they
          are given and carry the tier colour. */}
      {user.avatarPortraitUrl ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.avatarPortraitUrl}
            alt=""
            aria-hidden="true"
            className="h-full max-h-[90%] w-auto object-contain object-bottom"
          />
        </div>
      ) : user.profileImageUrl ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.profileImageUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-top"
          />
          {/* Fade the photo into the card so composed content below
              stays legible without a flat scrim over the face. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(13,13,13,0.96) 12%, rgba(13,13,13,0.55) 42%, rgba(13,13,13,0) 72%)",
            }}
            aria-hidden
          />
        </div>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span
            className="font-display font-semibold leading-none opacity-[0.18]"
            style={{
              fontSize: "clamp(72px, 38cqw, 190px)",
              color: TIER_ACCENT[tier],
              letterSpacing: "-0.04em",
            }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Holographic sheen overlay — only on Champion (legendary) tier */}
      {tier === "champion" && (
        <div
          className="pointer-events-none absolute inset-0 fm-holo-sheen mix-blend-screen"
          aria-hidden
        />
      )}

      {/* Composed content on top of the card */}
      {children && (
        <div className="relative z-10 flex h-full flex-col p-5">
          {children}
        </div>
      )}
    </div>
  );

  // The card is the profile. When a destination is given it becomes
  // the link to it rather than something you click past.
  if (!href) return card;
  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
    >
      {card}
    </Link>
  );
}

/**
 * Helper for callers: derive the trading-card tier from MVP state.
 * Returns "standard" for users without a published snapshot (Partners
 * before scoring) and for provisional members (good standing without
 * surfacing scores). Court eligibility (top 10% gate) collapses to
 * "champion" regardless of which band the OVR alone would suggest.
 */
export function deriveTradingCardTier(input: {
  ovr: number | null;
  isProvisional: boolean;
  isInChampionsCourt: boolean;
  /**
   * Membership sets the floor. Without it a Member with no published
   * snapshot fell to `standard` and rendered in the neutral grey a
   * Partner gets — which reads as though membership was lost because
   * a rating hadn't been computed yet.
   */
  membershipTier?: MembershipTier;
}): TradingCardTier {
  const floor: TradingCardTier =
    input.membershipTier === "member" ? "member" : "standard";
  if (input.ovr === null) return floor;
  if (input.isProvisional) return floor;
  if (input.isInChampionsCourt) return "champion";
  if (input.ovr >= 80) return "future_modernist";
  if (input.ovr >= 75) return "promotion_eligible";
  if (input.ovr >= 70) return "good_standing";
  return "probation";
}
