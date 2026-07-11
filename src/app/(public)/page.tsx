/**
 * Public landing page. Ports the Vercel frontend hero + process +
 * pillars, restyled against the codified Tailwind palette so the
 * whole app lives on one visual system.
 */
import Link from "next/link";
import { INDUSTRY_LABELS, publicName, type Industry } from "@/lib/types";
import { SERVICE_PARTNERS } from "@/lib/mock-data/partners";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { latestCohortSpotlight } from "@/lib/mock-data/cohort-spotlights";
import { TradingCard, type TradingCardTier } from "@/components/TradingCard";
import { Faq, type FaqItem } from "@/components/Faq";
import { Avatar } from "@/components/Avatar";

/**
 * Static-rendered. Roster reads MOCK_USERS at build time; no request-time
 * dependencies. Home serves as cached HTML from the edge.
 */
export const dynamic = "force-static";

export default function Home() {
  return (
    <>
      <Hero />
      <ContributorAffiliations />
      <Process />
      <Pillars />
      <Roster />
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
 * (which mixes client history with cooperator provenance), this is
 * personnel provenance — where cooperators have done credited work.
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
function Roster() {
  // Fixed 5-card lineup showing the RPG rarity ladder end-to-end for
  // homepage launch-design demonstration. Locked 2026-07-01 per Jamar:
  // Jamar gold · BBG magenta · Sunny blue · Bayu green · Sahtyre grey.
  // Sandbox illustration — production replaces with dynamic top-N
  // discovery-eligible Members computed from MVP snapshot bands.
  const ROSTER: { userId: string; tier: TradingCardTier }[] = [
    { userId: "u_jamar", tier: "champion" },
    { userId: "u_bbg", tier: "future_modernist" },
    { userId: "u_sunny", tier: "promotion_eligible" },
    { userId: "u_bayu", tier: "good_standing" },
    { userId: "u_sahtyre", tier: "probation" },
  ];

  const preview = ROSTER.map(({ userId, tier }) => {
    const user = MOCK_USERS.find((u) => u.id === userId);
    return user ? { user, tier } : null;
  }).filter((row): row is { user: (typeof MOCK_USERS)[number]; tier: TradingCardTier } => row !== null);

  if (preview.length === 0) return null;

  return (
    <section className="fm-below-fold border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-magenta">
              The cooperative
            </div>
            <h2 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
              Members shipping the work
            </h2>
            <p className="mt-3 max-w-2xl text-ink-muted">
              Standing on the card. Champion&apos;s Court gold at the top,
              Future Modernist magenta, promotion-eligible blue, good
              standing green, probation grey.
            </p>
          </div>
          <Link
            href="/team"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta hover:text-brand-magenta"
          >
            View full roster →
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {preview.map(({ user, tier }) => (
            <Link
              key={user.id}
              href={`/u/${user.handle}`}
              className="group block"
            >
              <TradingCard
                user={user}
                tier={tier}
                aspectRatio="3/4"
                className="transition-transform group-hover:-translate-y-1"
              />
              <div className="mt-3">
                <div className="font-display text-lg font-semibold">
                  {publicName(user)}
                </div>
                {user.discipline && (
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {user.discipline}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

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
          Fortune 500-caliber cooperators across the industries we serve.
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

function Partners() {
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
          {SERVICE_PARTNERS.map((p) => (
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
        "Upwork and Toptal are marketplaces owned by shareholders. When you hire through them, most of the money reaches the freelancer; the platform keeps the rest and the freelancer keeps none of the platform.\n\n$BUILD.Store is owned by its Members. The people you hire hold governance in the platform they work through. That changes the incentives all the way down: quality, retention, follow-through. The cooperators aren't renting the platform. They own it.",
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
 * Cohort rail — landing preview of the most recent cohort spotlight.
 *
 * Rolling monthly content engine: whoever most recently joined the
 * cooperative gets a small hero card here on the homepage, cycling
 * as the roster grows. Click through to /cohort/[period] for the
 * full narrative + cross-linked cooperator profiles.
 */
function CohortRail() {
  const spotlight = latestCohortSpotlight();
  if (!spotlight) return null;

  const users = spotlight.userIds
    .map((id) => MOCK_USERS.find((u) => u.id === id))
    .filter((u): u is (typeof MOCK_USERS)[number] => !!u);

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

        <div className="mt-8 grid gap-6 md:grid-cols-[2fr_1fr]">
          <div>
            <p className="text-ink-muted">{spotlight.narrative}</p>
            <Link
              href={`/cohort/${spotlight.periodKey}`}
              className="mt-4 inline-block text-sm text-brand-magenta hover:underline"
            >
              Read the full spotlight →
            </Link>
          </div>
          {users.length > 0 && (
            <ul className="space-y-3">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3"
                >
                  <Avatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold">
                      {publicName(user)}
                    </p>
                    {user.discipline && (
                      <p className="truncate text-xs text-ink-muted">
                        {user.discipline}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
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
