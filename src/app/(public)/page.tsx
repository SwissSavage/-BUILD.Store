/**
 * Public landing page. Ports the Vercel frontend hero + process +
 * pillars, restyled against the codified Tailwind palette so the
 * whole app lives on one visual system.
 */
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { CohortDeck } from "@/components/CohortDeck";
import { HomepageQuestionForm } from "@/components/HomepageQuestionForm";
import { PillarExplorer } from "@/components/PillarExplorer";
import { ProcessExplorer } from "@/components/ProcessExplorer";
import { ScrollReveal } from "@/components/ScrollReveal";
import { getCurrentUser } from "@/lib/auth-stub";
import { publicName } from "@/lib/types";
import { memberLabel } from "@/lib/member-label";
import { getAllUsers } from "@/lib/readers/users";
import { servicePartnerReader, spotlightReader, safely } from "@/lib/readers";
import {
  activeRecognitionUserIds,
  publicProfileEligible,
} from "@/lib/profile-visibility";
import { periodKeyFor } from "@/lib/recognition-period";
import { deriveTradingCardTier } from "@/components/TradingCard";
import { Faq, type FaqItem } from "@/components/Faq";
import { Avatar } from "@/components/Avatar";
import { PUBLIC_BOOKING_CTA, PUBLIC_BOOKING_URL } from "@/lib/public-booking";

/**
 * Rendered per request.
 *
 * This page was ISR-with-revalidate for one deploy and it was wrong:
 * CI builds the image with a dummy DATABASE_URL, so every read at
 * build time throws, `safely` returns empty, and the roster and
 * cohort rails render nothing. That empty output is then what gets
 * served and cached.
 *
 * A marketing page that can't reach the database at build time cannot
 * be statically generated from database content. If the request-time
 * cost ever matters, the fix is a cache around the two reads, not
 * static generation.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  return (
    <>
      <Hero />
      <div className="relative isolate overflow-hidden bg-[#06070a]">
        <div className="relative isolate overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-64 top-1/3 hidden h-[44rem] w-[44rem] -translate-y-1/2 opacity-[0.045] md:block"
          >
            <Image
              src="/brand/turtle.png"
              alt=""
              fill
              sizes="44rem"
              className="object-contain brightness-0 invert"
            />
          </div>
          <div className="relative z-10">
            <Process />
            <Pillars />
          </div>
        </div>
        <ScrollReveal>
          <CohortRail />
        </ScrollReveal>
        <Partners />
        <FaqSection />
      </div>
    </>
  );
}

type HomepageTone = "hero";

const HOMEPAGE_BACKGROUNDS: Record<HomepageTone, string> = {
  hero:
    "radial-gradient(70% 70% at 88% 14%, rgba(216, 40, 160, 0.20) 0%, transparent 62%), radial-gradient(68% 65% at 8% 88%, rgba(80, 112, 240, 0.20) 0%, transparent 64%), linear-gradient(145deg, #060509 0%, #030407 48%, #070407 100%)",
};

/** Homepage-only section atmosphere; public route backgrounds remain unchanged. */
function HomepageBackdrop({ tone }: { tone: HomepageTone }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ background: HOMEPAGE_BACKGROUNDS[tone] }}
    />
  );
}

/**
 * Contributor-affiliations trust-strip — anchors the bottom of the hero.
 *
 * Mirrors the framing Bayu shipped on afuturemodern.com: instead of
 * "trusted by 800k businesses" scale flex or "we shipped for X client"
 * (which mixes client history with builder provenance), this is
 * personnel provenance — where builders have done credited work.
 * Bigger brand torque, cleaner legal posture, more honest to FM's
 * real leverage.
 *
 * Disclaimer stays visible so nobody reads the strip as endorsement
 * from the named institutions.
 *
 * When Bayu delivers logo assets they replace the wordmarks 1:1; the
 * layout and copy stay.
 */
function ContributorAffiliations() {
  const AFFILIATIONS = [
    "Microsoft",
    "Amazon",
    "Caltech",
    "Cal Berkeley",
    "Smithsonian",
    "Columbia Records",
    "WebMD",
    "Complex",
  ] as const;

  return (
    <div className="relative w-full border-t border-[var(--surface-border)]">
      <div className="mx-auto max-w-app px-6 py-7 md:py-8">
        <p className="text-center text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          Contributors have shipped work at
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-ink-muted">
          {AFFILIATIONS.map((name) => (
            <li
              key={name}
              className="whitespace-nowrap transition-colors hover:text-ink"
            >
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-[10px] text-ink-faint">
          Contributor affiliations are listed for context only and do
          not imply endorsement of Future Modern Builderberg LLC or
          $BUILD.Store.
        </p>
      </div>
    </div>
  );
}

/**
 * Cooperative roster preview — top four discovery-eligible Members
 * shown as TradingCards on the public landing page. Sorted by rarity
 * tier so Champion's Court cards land first. Full roster (signed-in
 * Members only) lives at /team.
 *
 * Fits the platform-as-marketing-infrastructure principle: the
 * homepage is what a Partner would send a client, and the cooperative's
 * people belong on it — not as generic avatars but as the branded
 * player cards that signal how the cooperative organizes.
 */
function HeroVideo({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={
        mobile
          ? "hero-video-stage hero-video-stage--mobile relative mt-12 aspect-video w-full overflow-hidden md:hidden"
          : "hero-video-stage absolute inset-0 hidden overflow-hidden md:block"
      }
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="hero-video-stage-media h-full w-full object-cover object-center"
      >
        <source src="/videos/future-modern-hero.mp4" type="video/mp4" />
      </video>
      {mobile ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/45 to-[#050508]/65" />
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#050508] to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#050508_0%,#050508_35%,rgba(5,5,8,0.96)_49%,rgba(5,5,8,0.58)_68%,rgba(5,5,8,0.22)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(72%_92%_at_8%_88%,rgba(80,112,240,0.22)_0%,rgba(5,5,8,0.92)_50%,transparent_74%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_48%,rgba(216,40,160,0.10),transparent_62%)]" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#050508] via-[#050508]/85 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-[#050508]/55 to-transparent" />
        </>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-68px)] flex-col overflow-hidden border-b border-[var(--surface-border)] bg-[#050508]">
      <HomepageBackdrop tone="hero" />
      <HeroVideo />
      <div className="relative z-10 mx-auto flex w-full max-w-app flex-1 flex-col justify-center px-6 py-20 md:py-24">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex self-start items-center gap-2 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-green">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
            Future Modern
          </div>
          <h1 className="font-display text-5xl font-bold leading-tight md:text-7xl">
            $BUILD with the{" "}
            <span className="bg-gradient-to-r from-brand-magenta to-brand-blue bg-clip-text text-transparent">
              best.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-muted md:text-xl">
            $BUILD <strong className="text-ink">a team</strong> from our handpicked
            talent pool of Fortune 500-level STEM, Creative Media, and Professional
            Services professionals. Perfectly matched to your project.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink
              href="/signup"
              variant="primary"
              size="large"
              className="px-8 py-3 shadow-lg shadow-brand-magenta/20"
            >
              Get started
            </ButtonLink>
            <ButtonLink
              href={PUBLIC_BOOKING_URL}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
              size="large"
              className="border-brand-blue/60 px-8 py-3 text-brand-blue hover:bg-brand-blue/10"
            >
              {PUBLIC_BOOKING_CTA}
            </ButtonLink>
          </div>

          {/* Positional strip — Web3-native without being crypto-bro.
              Three small signals a considered reader clocks in half a
              second. Each one links to the surface where the receipt
              lives, so the strip reads as a promise you can verify. */}
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.15em] text-ink-faint">
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="fm-btn-primary inline-block h-1.5 w-1.5 rounded-full"
              />
              <Link
                href="/governance#canonization"
                className="transition-colors hover:text-ink"
              >
                Web3-native
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-brand-blue"
              />
              <Link
                href="/governance#tier"
                className="transition-colors hover:text-ink"
              >
                Worker-owned
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-brand-green"
              />
              <Link
                href="/policies/covenant"
                className="transition-colors hover:text-ink"
              >
                Peer-reviewed
              </Link>
            </li>
          </ul>
          <HeroVideo mobile />
        </div>
      </div>
      <div className="relative z-10 bg-[#050508]/90">
        <ContributorAffiliations />
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="bg-transparent">
      <div className="mx-auto max-w-app px-6 pb-12 pt-20 md:pb-14">
        <ScrollReveal>
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            Our process
          </h2>
          <p className="mt-2 max-w-2xl text-ink-muted">
            From a clear brief to a recorded closeout.
          </p>
          <ProcessExplorer />
        </ScrollReveal>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section className="bg-transparent">
      <div className="mx-auto max-w-app px-6 pb-20 pt-12 md:pt-14">
        <ScrollReveal>
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Three pillars</h2>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Fortune 500-caliber builders across the industries we serve.
          </p>
          <PillarExplorer />
        </ScrollReveal>
      </div>
    </section>
  );
}

async function Partners() {
  const partners = await safely(() => servicePartnerReader.all(), []);
  // Nothing to show until real signed relationships exist. The whole
  // section disappears rather than rendering an empty grid under a
  // heading that claims partners.
  if (partners.length === 0) return null;

  return (
    <section className="fm-below-fold bg-transparent">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">
              Service partners
            </h2>
            <p className="mt-2 max-w-2xl text-ink-muted">
              External orgs FM has signed letters of intent with for service
              co-delivery. Capabilities span engineering, design, film,
              growth, and photography.
            </p>
          </div>
          <Link
            href="/partners"
            className="text-sm text-brand-magentaText hover:underline"
          >
            See full ecosystem →
          </Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {partners.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 transition-colors hover:border-brand-blue"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                {p.shippedTogether && (
                  <span className="text-[10px] uppercase tracking-wider text-[#007048]">
                    Shipped together
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-ink-muted">
                {p.capabilities.map((cap) => (
                  <li key={cap}>{cap}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Landing FAQ — objection-handling in FM voice + FAQPage JSON-LD so
 * Google renders these as expandable Q&A in the SERP itself. Real
 * SERP real-estate for zero cost.
 */
function FaqSection() {
  const items: FaqItem[] = [
    {
      question: "What is $BUILD.Store?",
      answer:
        "$BUILD.Store is where Future Modern organizes, staffs, and delivers work. It brings together STEM, Creative Media, and Professional Services professionals who ship serious work for serious clients.\n\nInstead of a marketplace that skims from every transaction, cash flows to the Members who did the work. Ownership stays with the people who built the platform.",
    },
    {
      question: "How is this different from Upwork or Toptal?",
      answer:
        "Upwork and Toptal are marketplaces owned by shareholders. When you hire through them, most of the money reaches the freelancer; the platform keeps the rest and the freelancer keeps none of the platform.\n\n$BUILD.Store is owned by its Members. The people you hire hold governance in the platform they work through. That changes the incentives all the way down: quality, retention, follow-through. The builders aren't renting the platform. They own it.",
    },
    {
      question: "Who's in Future Modern?",
      answer:
        "Fortune 500-level professionals across three pillars: STEM (engineering, data, AI/ML, blockchain, cybersecurity, research), Creative Media (music, film, editorial, design, direction, post-production), and Professional Services (strategy, legal, finance, operations, management consulting).\n\nEvery Member is vouched in. There's a whitelist and a covenant. Standing is earned through shipped work and honest peer review. Not gamed through ratings inflation.",
    },
    {
      question: "How does hiring work?",
      answer:
        "You post your project. Our matcher narrows the field to three to five qualified Member teams inside the zone of possible agreement. You pick your lead. The team runs delivery with member-led autonomy. You track milestones in real time; cash and $BUILD tokens settle automatically when the work lands.\n\nNo bidding wars. No thousand-résumé pileups. No AI-generated proposals from strangers.",
    },
    {
      question: "What does \"Web3-native\" actually mean here?",
      answer:
        "Every Member holds their contribution record on-chain through an ERC-721 canonization card with an ERC-6551 token-bound account. That's how Future Modern encodes standing. Not as a rating in someone else's database, but as portable proof the Member owns.\n\nClients don't need a wallet to hire us. But if you care about how Future Modern handles provenance, the receipts are on-chain.",
    },
    {
      question: "How do I join?",
      answer:
        "The whitelist at /whitelist is the front door. It's currently a curated intake. Future Modern is small enough that every Member is a considered addition. As we scale, more of that intake automates.\n\nProspects can start by contributing on projects; Partners can co-deliver with Members. The full membership tier structure is documented in the Cooperative Covenant.",
    },
  ];

  return (
    <div className="[&>section]:border-transparent [&>section]:bg-transparent">
      <ScrollReveal>
        <Faq
          eyebrow="Common questions"
          heading="How Future Modern works"
          items={items}
          aside={<HomepageQuestionForm />}
        />
      </ScrollReveal>
    </div>
  );
}

/**
 * Cohort rail — who most recently joined the cooperative.
 *
 * ─────────────────────────────────────────────────────────────
 * AUTOMATIC BY DEFAULT (2026-09-01)
 *
 * This was described as a rolling engine that cycles as the roster
 * grows, but it only ever rendered a hand-authored cohort_spotlights
 * row — and nothing could write that table, so it rendered nothing.
 * Multiple people signed on and the homepage never said so.
 *
 * Now it derives from the roster: the most recent joins, no curation
 * required. A curated spotlight, when one exists for the current
 * period, overrides it — that's the editorial layer, not the
 * mechanism.
 *
 * Discovery gate applies either way (profile-visibility.ts, the
 * matrix in future-modern.md): Members always, Partners only inside
 * an active recognition window, opted-out never. Viewers never — they
 * haven't joined anything. Without that this becomes a directory
 * someone can work through to reach talent directly.
 * ─────────────────────────────────────────────────────────────
 */
/**
 * How many joiners the rail carries before it overflows.
 *
 * Eight fits the column without the rail eating the page. The count of
 * everyone beyond that still shows, so a growing cooperative reads as
 * growing rather than as a list that stopped.
 */
/**
 * A compact date for the roster card and an explicit version for screen
 * readers. The visible label stays quiet; the accessible label retains the
 * fact that it is a join date.
 */
function joinDateLabel(iso: string | null | undefined): {
  compact: string;
  accessible: string;
} {
  if (!iso) return { compact: "Recent", accessible: "Joined recently" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { compact: "Recent", accessible: "Joined recently" };
  }

  return {
    compact: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    accessible: `Joined ${d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`,
  };
}

async function CohortRail() {
  const [spotlights, { users: roster }, recognizedIds] = await Promise.all([
    safely(() => spotlightReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    safely(() => activeRecognitionUserIds(), new Set<string>()),
  ]);

  const now = new Date();
  const thisPeriod = periodKeyFor(now, "month");

  // A curated spotlight governs ITS OWN PERIOD ONLY.
  //
  // It used to be "the newest spotlight row wins, forever". A curated
  // row written in July then governed September, and because the rail
  // rendered exactly its userIds, anyone who joined after it was
  // invisible. Worse, ids that no longer resolve against the users
  // table filtered down to an empty array and the whole section
  // returned null — a hand-written row from two months ago silently
  // blanking the live join feed.
  const curated =
    [...spotlights].find((s) => s.periodKey === thisPeriod.key) ?? null;

  // Everyone eligible to appear, IN THE ORDER THEY JOINED.
  //
  // Ascending, not newest-first: this is a cohort, and a cohort reads
  // as the sequence people arrived in. Newest-first also reshuffled
  // the rail on every signup, so nobody held a position.
  const eligible = roster
    .filter((u) => publicProfileEligible(u, recognizedIds))
    // Newest first. The rail resets each month in the sense that the
    // current month leads it, and earlier months follow in the same
    // continuous scroll rather than being hidden behind a link.
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  // The two rails are divided into newest and earlier joiners in CohortDeck,
  // so keep this source list strictly chronological. A curated spotlight can
  // shape the section copy, but must not move an older builder into the newer
  // rail or create a duplicate across both tracks.
  // No cap. Capping produced a "+N more" card that hid the people it was
  // counting, on the one section whose job is to show that people are joining.
  const users = eligible;
  const thisMonthKey = thisPeriod.key;
  const joinedThisMonth = users.filter((u) =>
    (u.createdAt ?? "").startsWith(thisMonthKey),
  ).length;

  // Why anyone in the roster is NOT on the rail — counted from the
  // roster, not assumed. Surfaced to admins below, because a rail that
  // renders nothing is indistinguishable from nobody having signed up.
  const excluded = {
    viewer: roster.filter((u) => u.membershipTier === "viewer").length,
    optedOut: roster.filter((u) => u.profilePublic === false).length,
    partnerNotRecognized: roster.filter(
      (u) =>
        u.membershipTier !== "member" &&
        u.membershipTier !== "viewer" &&
        u.profilePublic !== false &&
        !recognizedIds.has(u.id),
    ).length,
  };
  const totalRoster = roster.length;

  if (users.length === 0) {
    // Nothing eligible to show. Report the roster to an admin instead
    // of rendering null — COUNTED FROM THE ROSTER, not assumed. A rail
    // that silently disappears is indistinguishable from nobody having
    // signed up, and guessing at the reason wastes everyone's time.
    const viewer = await safely(() => getCurrentUser(), null);
    if (!viewer?.isAdmin || totalRoster === 0) return null;
    return (
      <section className="bg-transparent">
        <div className="mx-auto max-w-app px-6 py-10">
          <div className="text-xs uppercase tracking-wider text-brand-blue">
            This month&apos;s cohort · admin only
          </div>
          <p className="mt-2 max-w-2xl text-ink-muted">
            {totalRoster} {totalRoster === 1 ? "account" : "accounts"} in
            the roster, none eligible for the public rail.
          </p>
          <RosterBreakdown excluded={excluded} />
          <Link
            href="/admin/members"
            className="fm-btn-primary mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-medium"
          >
            Open member admin →
          </Link>
        </div>
      </section>
    );
  }

  const spotlight = curated ?? {
    periodKey: thisPeriod.key,
    periodLabel: thisPeriod.label,
    headline:
      joinedThisMonth === 1
        ? `${publicName(users[0])} joined Future Modern`
        : joinedThisMonth > 1
          ? `${joinedThisMonth} builders joined Future Modern`
          : "Future Modern builders",
    narrative: "",
  };

  return (
    <section className="bg-transparent">
      <div className="mx-auto max-w-app px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {/* "Cohort" removed 2026-09-02. Jamar: "We don't say
                cohort, it's an empty word." Not replaced with a
                synonym, because the headline underneath already says
                the thing plainly. */}
            <div className="text-xs uppercase tracking-wider text-brand-blue">
              {spotlight.periodLabel}
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              {spotlight.headline}
            </h2>
          </div>
          <Link
            href="/cohort"
            className="text-sm text-brand-magentaText hover:underline"
          >
            Everyone who has joined →
          </Link>
        </div>

        <div className="mt-4 max-w-2xl">
          {/* The narrative and the deep link only exist for a curated
              spotlight. On the automatic path there is no written
              piece to read, so promising one would be a dead click. */}
          {curated ? (
            <>
              <p className="text-ink-muted">{curated.narrative}</p>
              <Link
                href={`/cohort/${curated.periodKey}`}
                className="mt-4 inline-block text-sm text-brand-magentaText hover:underline"
              >
                Read the full spotlight →
              </Link>
            </>
          ) : (
            <p className="text-ink-muted">
              Newest Future Modern builders. Every engagement
              routes through Future Modern.
            </p>
          )}
        </div>

        {users.length > 0 && (
          <CohortDeck
            builders={users.map((user) => {
              const joined = joinDateLabel(user.createdAt);

              return {
                id: user.id,
                href: `/u/${user.handle}`,
                name: publicName(user),
                label: memberLabel(user),
                joinedLabel: joined.compact,
                joinedAriaLabel: joined.accessible,
                membershipTier: user.membershipTier,
                user: {
                  id: user.id,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  handle: user.handle,
                  profileImageUrl: user.profileImageUrl,
                  avatarPortraitUrl: user.avatarPortraitUrl,
                },
                tier: deriveTradingCardTier({
                  ovr: null,
                  isProvisional: true,
                  isInChampionsCourt: false,
                  membershipTier: user.membershipTier,
                }),
              };
            })}
          />
        )}
        {users.length < totalRoster && (
          <AdminRosterNote shown={users.length} total={totalRoster} excluded={excluded} />
        )}
      </div>
    </section>
  );
}

/** Why roster members aren't on the rail — plain counts, no inference. */
function RosterBreakdown({
  excluded,
}: {
  excluded: { viewer: number; optedOut: number; partnerNotRecognized: number };
}) {
  const reasons = [
    [excluded.viewer, "still set to Viewer"],
    [excluded.optedOut, "opted out of a public profile"],
    [excluded.partnerNotRecognized, "Partners outside a recognition window"],
  ] as const;
  const live = reasons.filter(([n]) => n > 0);
  if (live.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs text-ink-faint">
      {live.map(([n, why]) => (
        <li key={why}>
          {n} {why}
        </li>
      ))}
    </ul>
  );
}

/**
 * Admin-only footer: what the rail is showing vs what's in the roster.
 *
 * Renders nothing for everyone else, so it sits inside a public section
 * without leaking that anyone is held back.
 */
async function AdminRosterNote({
  shown,
  total,
  excluded,
}: {
  shown: number;
  total: number;
  excluded: { viewer: number; optedOut: number; partnerNotRecognized: number };
}) {
  const viewer = await safely(() => getCurrentUser(), null);
  if (!viewer?.isAdmin) return null;
  return (
    <div className="mt-6 border-t border-[var(--surface-border)] pt-4">
      <p className="text-xs text-ink-faint">
        Admin only — showing {shown} of {total} accounts.{" "}
        <Link href="/admin/members" className="text-brand-magentaText hover:underline">
          Member admin →
        </Link>
      </p>
      <RosterBreakdown excluded={excluded} />
    </div>
  );
}

/*
 * SandboxBanner REMOVED 2026-09-02.
 *
 * It sat at the bottom of the public homepage saying "Sandbox build.
 * Click Sign in to explore the member and admin surfaces with mock
 * data." Every part of that is now false: the data is real, the
 * members are real, and the person reading it may well already be
 * signed in. Bayu hit exactly that.
 *
 * It was also on the page Jamar wants members sharing as marketing.
 * Telling a prospective client the platform is a sandbox full of fake
 * data is the opposite of what that page is for.
 */
