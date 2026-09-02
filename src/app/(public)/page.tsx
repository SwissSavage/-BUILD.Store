/**
 * Public landing page. Ports the Vercel frontend hero + process +
 * pillars, restyled against the codified Tailwind palette so the
 * whole app lives on one visual system.
 */
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";
import { INDUSTRY_LABELS, publicName, type Industry } from "@/lib/types";
import { memberLabel } from "@/lib/member-label";
import { getAllUsers } from "@/lib/readers/users";
import { servicePartnerReader, spotlightReader, safely } from "@/lib/readers";
import {
  activeRecognitionUserIds,
  publicProfileEligible,
} from "@/lib/profile-visibility";
import { periodKeyFor } from "@/lib/recognition-period";
import {
  TradingCard,
  deriveTradingCardTier,
} from "@/components/TradingCard";
import { Faq, type FaqItem } from "@/components/Faq";
import { Avatar } from "@/components/Avatar";

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
      <ContributorAffiliations />
      <Process />
      <Pillars />
      <CohortRail />
      <Partners />
      <FaqSection />
      <SandboxBanner />
    </>
  );
}

/**
 * Contributor-affiliations trust-strip — sits below the hero on the
 * landing page.
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
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-10">
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
    </section>
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
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--surface-border)] bg-[var(--surface)]">
      {/* Brand color wash — subtle magenta→blue gradient echoing the turtle shell. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          background:
            "radial-gradient(60% 60% at 85% 20%, #D828A0 0%, transparent 60%), radial-gradient(50% 50% at 15% 80%, #5070F0 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-app px-6 py-24 md:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-green">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
          Future Modern cooperative
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
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-brand-magenta px-8 py-3 font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
          >
            Get started
          </Link>
          <a
            href="https://calendly.com/properpreparationism"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-brand-blue/60 px-8 py-3 font-medium text-brand-blue transition-colors hover:bg-brand-blue/10"
          >
            Schedule a call
          </a>
        </div>

        {/* Positional strip — Web3-native without being crypto-bro.
            Three small signals a considered reader clocks in half a
            second. Each one links to the surface where the receipt
            lives, so the strip reads as a promise you can verify. */}
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.15em] text-ink-faint">
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-brand-magenta"
            />
            <Link
              href="/governance#canonization"
              className="transition-colors hover:text-ink"
            >
              Built Web3-native
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
              Owner-operated
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
              Cooperative-vetted
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    { n: "01", accent: "magenta", title: "Tell us your project", body: "Submit your RFP and budget. Our automated matcher narrows the field within the zone of possible agreement." },
    { n: "02", accent: "blue",    title: "Choose from 3–5 options", body: "Not a flood of resumes. A curated set of qualified member teams, skill-filtered to your project." },
    { n: "03", accent: "green",   title: "Pick your lead, stay in the loop", body: "Once awarded, the team runs delivery with DAO-style autonomy. You track milestones in real time." },
    { n: "04", accent: "magenta", title: "Revenue settles, tokens flow", body: "When revenue is collected, cash splits and $BUILD tokens distribute automatically to the crew." },
  ] as const;

  const accentClass = {
    magenta: "text-brand-magenta border-t-brand-magenta",
    blue:    "text-brand-blue border-t-brand-blue",
    green:   "text-brand-green border-t-brand-green",
  } as const;

  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Our process
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className={`rounded-2xl border border-t-4 border-[var(--surface-border)] bg-[var(--surface)] p-6 ${accentClass[s.accent]}`}
            >
              <div className={`font-display text-3xl ${accentClass[s.accent].split(" ")[0]}`}>{s.n}</div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const pillars: { key: Industry; blurb: string; accent: "blue" | "magenta" | "green" }[] = [
    { key: "stem",                  accent: "blue",    blurb: "Full-stack, data, AI/ML, blockchain, cybersecurity, research." },
    { key: "creative-media",        accent: "magenta", blurb: "Music, film, editorial, design, direction, post-production." },
    { key: "professional-services", accent: "green",   blurb: "Strategy, legal, finance, operations, management consulting." },
  ];

  const styles = {
    blue:    { ring: "hover:border-brand-blue",    text: "text-brand-blue",    dot: "bg-brand-blue" },
    magenta: { ring: "hover:border-brand-magenta", text: "text-brand-magenta", dot: "bg-brand-magenta" },
    green:   { ring: "hover:border-brand-green",   text: "text-brand-green",   dot: "bg-brand-green" },
  } as const;

  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">Three pillars</h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Fortune 500-caliber builders across the industries we serve.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => {
            const s = styles[p.accent];
            return (
              <div
                key={p.key}
                className={`rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6 transition-colors ${s.ring}`}
              >
                <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${s.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  Pillar
                </div>
                <h3 className="mt-2 font-display text-2xl font-semibold">
                  {INDUSTRY_LABELS[p.key]}
                </h3>
                <p className="mt-3 text-sm text-ink-muted">{p.blurb}</p>
              </div>
            );
          })}
        </div>
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
    <section className="fm-below-fold border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
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
            className="text-sm text-brand-magenta hover:underline"
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
        "$BUILD.Store is the cooperative talent platform of Future Modern. A member-owned network of STEM, Creative Media, and Professional Services professionals who ship serious work for serious clients.\n\nInstead of a marketplace that skims from every transaction, cash flows to the Members who did the work. Ownership stays with the people who built the platform.",
    },
    {
      question: "How is this different from Upwork or Toptal?",
      answer:
        "Upwork and Toptal are marketplaces owned by shareholders. When you hire through them, most of the money reaches the freelancer; the platform keeps the rest and the freelancer keeps none of the platform.\n\n$BUILD.Store is owned by its Members. The people you hire hold governance in the platform they work through. That changes the incentives all the way down: quality, retention, follow-through. The builders aren't renting the platform. They own it.",
    },
    {
      question: "Who's in the cooperative?",
      answer:
        "Fortune 500-level professionals across three pillars: STEM (engineering, data, AI/ML, blockchain, cybersecurity, research), Creative Media (music, film, editorial, design, direction, post-production), and Professional Services (strategy, legal, finance, operations, management consulting).\n\nEvery Member is vouched in. There's a whitelist and a covenant. Standing is earned through shipped work and honest peer review. Not gamed through ratings inflation.",
    },
    {
      question: "How does hiring work?",
      answer:
        "You post your project. Our matcher narrows the field to three to five qualified Member teams inside the zone of possible agreement. You pick your lead. The team runs delivery with cooperative-native autonomy. You track milestones in real time; cash and $BUILD tokens settle automatically when the work lands.\n\nNo bidding wars. No thousand-résumé pileups. No AI-generated proposals from strangers.",
    },
    {
      question: "What does \"Web3-native\" actually mean here?",
      answer:
        "Every Member holds their contribution record on-chain through an ERC-721 canonization card with an ERC-6551 token-bound account. That's how the cooperative encodes standing. Not as a rating in someone else's database, but as portable proof the Member owns.\n\nClients don't need a wallet to hire us. But if you care about how the cooperative treats provenance, the receipts are on-chain.",
    },
    {
      question: "How do I join?",
      answer:
        "The whitelist at /whitelist is the front door. It's currently a curated intake. The cooperative is small enough that every Member is a considered addition. As we scale, more of that intake automates.\n\nProspects can start by contributing on projects; Partners can co-deliver with Members. The full membership tier structure is documented in the Cooperative Covenant.",
    },
  ];

  return (
    <Faq
      eyebrow="Common questions"
      heading="How the cooperative works"
      items={items}
    />
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
const MAX_COHORT = 8;

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
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

  // Curated picks lead, then everyone else who joined, in join order.
  // CURATION ADDS, IT NEVER SUBTRACTS. Highlighting one person must not
  // delete the other six from the feed.
  const pinned = (curated?.userIds ?? [])
    .map((id) => roster.find((u) => u.id === id))
    .filter((u): u is (typeof roster)[number] => !!u)
    .filter((u) => publicProfileEligible(u, recognizedIds));

  const ordered = [
    ...pinned,
    ...eligible.filter((u) => !pinned.some((p) => p.id === u.id)),
  ];
  const users = ordered.slice(0, MAX_COHORT);
  const overflow = Math.max(0, ordered.length - users.length);

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
      <section className="border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
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
            className="mt-4 inline-block rounded-full bg-brand-magenta px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
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
      users.length === 1
        ? `${publicName(users[0])} joined the cooperative`
        : `${users.length} builders joined the cooperative`,
    narrative: "",
  };

  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-app px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-blue">
              This month&apos;s cohort · {spotlight.periodLabel}
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              {spotlight.headline}
            </h2>
          </div>
          <Link
            href="/cohort"
            className="text-sm text-brand-magenta hover:underline"
          >
            All spotlights →
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
                className="mt-4 inline-block text-sm text-brand-magenta hover:underline"
              >
                Read the full spotlight →
              </Link>
            </>
          ) : (
            <p className="text-ink-muted">
              Newest builders in the cooperative. Every engagement
              routes through Future Modern.
            </p>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────
            A RAIL, NOT A LIST (2026-09-02)

            This was a stacked column beside the copy. At three people
            it read fine; at eight it was a wall of rows, and it grows
            every time someone joins. Jamar: "this section just throws
            the profiles at you."

            Horizontal scroll with snap points, so the page shows a few
            and the reader moves through the rest at their own pace.
            CSS only — no autoplay, no carousel library, no JS. A
            rotating rail that moves on its own takes control away from
            someone trying to read a name, and it cannot be paused by
            anyone using a keyboard.

            The card is the profile, so each one is the trading card
            rather than an avatar in a row, and it links through.
            ───────────────────────────────────────────────────────── */}
        {users.length > 0 && (
          <div className="mt-10 -mx-6 overflow-x-auto px-6 pb-4 [scrollbar-width:thin] snap-x snap-mandatory">
            <ul className="flex gap-6">
              {users.map((user) => (
                <li key={user.id} className="w-44 shrink-0 snap-start md:w-52">
                  <Link href={`/u/${user.handle}`} className="group block">
                    <TradingCard
                      user={user}
                      tier={deriveTradingCardTier({
                        ovr: null,
                        isProvisional: true,
                        isInChampionsCourt: false,
                        membershipTier: user.membershipTier,
                      })}
                      aspectRatio="3/4"
                      className="transition-transform group-hover:-translate-y-1"
                    />
                    <div className="mt-3">
                      <div className="truncate font-display text-base font-semibold">
                        {publicName(user)}
                      </div>
                      {memberLabel(user) && (
                        <div className="mt-0.5 truncate text-xs text-ink-muted">
                          {memberLabel(user)}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
              {overflow > 0 && (
                <li className="flex w-44 shrink-0 snap-start items-center justify-center md:w-52">
                  <Link
                    href="/cohort"
                    className="rounded-2xl border border-dashed border-[var(--surface-border)] px-5 py-4 text-center text-sm text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
                  >
                    + {overflow} more
                    <span className="mt-1 block text-xs">in the cohort →</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
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
        <Link href="/admin/members" className="text-brand-magenta hover:underline">
          Member admin →
        </Link>
      </p>
      <RosterBreakdown excluded={excluded} />
    </div>
  );
}

function SandboxBanner() {
  return (
    <section className="fm-below-fold bg-brand-magenta/10">
      <div className="mx-auto max-w-app px-6 py-8 text-center text-sm">
        <strong className="text-brand-magenta">Sandbox build.</strong>{" "}
        <span className="text-ink-muted">
          Click <Link href="/signin" className="underline">Sign in</Link> to explore the member and admin surfaces with mock data.
        </span>
      </div>
    </section>
  );
}
