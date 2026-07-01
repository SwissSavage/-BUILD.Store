/**
 * About Us — purpose, the cooperative model, and where we're going.
 *
 * This page exists at the seam between $BUILD.Store and the wider Future
 * Modern parent (the eventual `afuturemodern.com` marketing site, captured
 * in roadmap Phase 3 / 0.12). Until that parent site exists, /about lives
 * here — close enough to the product surface that prospective members can
 * read the cooperative principles right before they apply.
 *
 * Tone (revised 2026-04-25): debonair, driven, people-powered. We don't
 * fabricate; the resumes speak for themselves. None of our clients came
 * from freelance platforms — anything visible there is a testament to
 * who we are, not a credential. Voice draws from the Future Modern Brand
 * Marketing Strategy: Purpose, Vision, Provenance / Discernment / Equity,
 * tagline "Rare∞."
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { VentureLaborConstellation } from "@/components/VentureLaborConstellation";

export const metadata = {
  title: "About · $BUILD.Store",
  description:
    "Future Modern Builderberg LLC is the radical curation network unifying art and technology to distribute equity. People-powered, exclusively. Access is earned — never sold.",
};

export default function AboutPage() {
  return (
    <>
      <Hero />
      <PurposeVision />
      <PeoplePowered />
      <VentureLabor />
      <ConstellationSection />
      <CoreCompetencies />
      <Provenance />
      <Credentials />
      <WhatChanged />
      <Pillars />
      <RoadmapPeek />
      <CTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          background:
            "radial-gradient(60% 60% at 80% 20%, #D828A0 0%, transparent 60%), radial-gradient(50% 50% at 10% 90%, #007048 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-app px-6 py-20 md:py-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-3 py-1 text-xs font-medium text-brand-magenta">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-magenta" />
          About Future Modern
        </div>
        <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">
          The radical curation network unifying{" "}
          <span className="bg-gradient-to-r from-brand-magenta to-brand-blue bg-clip-text text-transparent">
            art and technology
          </span>{" "}
          to distribute equity.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted md:text-xl">
          Future Modern Builderberg LLC is people-powered, exclusively. A
          cooperative of creatives, professionals, scientists, and techies
          who are already reputed in their fields — and who built this
          because the economics owed to the people doing the work weren&apos;t
          getting paid out anywhere else.
        </p>
        <p className="mt-4 max-w-2xl text-base text-ink-faint italic">
          We&apos;re not trying to be special. We are special. We don&apos;t
          care if anyone sees it.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-3 py-1 font-medium text-brand-magenta">
            For workers, not capitalists
          </span>
          <span className="rounded-full border border-brand-blue/40 bg-brand-blue/10 px-3 py-1 font-medium text-brand-blue">
            People-powered, exclusively
          </span>
          <span className="rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 font-medium text-brand-green">
            Access is earned, not sold
          </span>
        </div>
      </div>
    </section>
  );
}

function PurposeVision() {
  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-magenta">
              Purpose
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              The wave others ride.
            </h2>
            <p className="mt-5 text-ink-muted">
              We exist to acknowledge and compensate the expression of
              original ideas and labor that move culture forward. Provenance
              first — then everything else.
            </p>
            <p className="mt-4 text-ink-muted">
              In one sentence: the radical curation network unifying art
              and technology to distribute equity.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-brand-blue">
              Vision
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              Capital, redistributed.
            </h2>
            <p className="mt-5 text-ink-muted">
              To redistribute human and financial capital from concentrated
              powers to dynamic grassroots communities. To construct a world
              where community integrates with life, art, appreciation, and
              passion.
            </p>
            <p className="mt-4 text-ink-muted">
              Driven and debonair. Strong, aggressive, absurd, weird —
              self-assured and dynamic, creative and perceptive. We tackle
              missions with diligence, grit, and daring.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-8 py-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Tagline
            </div>
            <div className="mt-2 font-display text-5xl font-bold tracking-tight">
              Rare<span style={{ color: "#D828A0" }}>∞</span>
            </div>
          </div>
          <p className="max-w-md text-sm text-ink-muted">
            For savvy seekers and independent creators who share a deep
            value for cultural contribution. We provide content, services,
            and resources counter to those currently found in legacy media
            and traditional industry, which fail to cater to their
            appetites.
          </p>
        </div>
      </div>
    </section>
  );
}

function PeoplePowered() {
  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="grid gap-10 md:grid-cols-[1.5fr,1fr]">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-green">
              People-powered, exclusively
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              The resumes speak for themselves.
            </h2>
            <div className="mt-6 space-y-5 text-ink-muted">
              <p>
                The people who built this are already reputed in their
                fields. Top performers at the companies they passed through.
                Founding hires at platforms that went on to IPO. Engineers
                at Caltech, Berkeley, and the Smithsonian. Designers and
                writers at Columbia Records, Bad Boy, Mad Decent, Complex.
                Operators at Microsoft, Amazon, Lenovo, Bird, WebMD, the
                LADWP.
              </p>
              <p>
                We didn&apos;t stay long inside any of them. Top performance
                wasn&apos;t the issue — fit was. The pattern was the same
                every time: vindication afterwards. The people who built
                Future Modern are the ones who keep moving when the room
                they&apos;re in stops being big enough for what they
                actually do.
              </p>
              <p>
                None of our clients came from freelance platforms. Anything
                visible there is a testament to who we are, not a credential
                we&apos;re trading on. Our work has always come through
                relationships — through the people who&apos;ve seen us
                deliver and stayed in the room.
              </p>
              <p>
                $BUILD.Store is the platform we built so the next generation
                of that talent doesn&apos;t have to leave a half-dozen
                companies to be paid what their work is worth. The
                cooperative is the structure. The people are the proof.
              </p>
            </div>
          </div>

          <Card className="self-start">
            <CardEyebrow>What &quot;people-powered&quot; means</CardEyebrow>
            <CardTitle className="mt-2">Earned, not bought</CardTitle>
            <ul className="mt-4 space-y-3 text-sm text-ink-muted">
              <li>
                <span className="text-ink">Access is earned.</span> Three
                paths in: invitation from an existing member, application +
                vetting, or contribution to the cooperative&apos;s
                infrastructure. The whitelist is not for sale.
              </li>
              <li>
                <span className="text-ink">Admin-authored framing.</span>{" "}
                Members submit objective fields — price, timeline, work
                samples. The cooperative authors the positioning so the work
                speaks for itself, not the cold-pitch voice.
              </li>
              <li>
                <span className="text-ink">85% to the people who shipped.</span>{" "}
                One 15% house cut funds shared infrastructure. No agency
                middleman, no platform tax stacked on top.
              </li>
              <li>
                <span className="text-ink">Attribution is permanent.</span>{" "}
                The ledger compounds across years. Contributions don&apos;t
                reset to zero when a contract closes.
              </li>
            </ul>
            <p className="mt-4 text-xs text-ink-faint">
              We don&apos;t curate around credentials. We curate around
              people who&apos;ve done the work and care about doing it
              right.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

function VentureLabor() {
  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="grid gap-10 md:grid-cols-[1fr,1.5fr]">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-magenta">
              The contract
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              We call this Venture Labor.
            </h2>
            <p className="mt-5 text-ink-muted">
              Venture Capital pools money and goes looking for labor to
              multiply it. Venture Labor is the inversion. People who can
              do the work pool their skill and time, and the upside on
              what gets shipped belongs to the people who shipped it.
            </p>
            <p className="mt-4 text-ink-muted">
              The phrase is honest about where we came from. Patrons
              used to buy into an artist&apos;s work to keep it moving
              until it sold. The tradition is real, and the controls
              around it were historically lazy: no point-of-sale
              discipline, contracts that read like favors, profit
              conversations that did not happen until the money was
              already gone. We kept the underlying idea and fixed the
              controls. We stopped pretending the labor was not equity.
            </p>
          </div>

          <Card className="self-start">
            <CardEyebrow>The vetting bar</CardEyebrow>
            <CardTitle className="mt-2">
              Ideological as much as technical.
            </CardTitle>
            <p className="mt-3 text-sm text-ink-muted">
              The failure mode of pooled labor is not the people who
              cannot do the work. It is the people who can do the work
              and will throw out the agreement the moment a check
              clears. We vet for that first. The craft we can teach.
              The values we cannot, and we have stopped trying.
            </p>
            <p className="mt-4 border-l-2 border-brand-magenta/40 pl-3 text-xs italic text-ink-faint">
              Anyone who can&apos;t handle money, in the sense that
              they throw out all ideals for it, is not one of us. We
              don&apos;t care how good they are.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

function WhatChanged() {
  const rows: { old: string; ours: string; accent: "magenta" | "blue" | "green" }[] = [
    {
      old: "Platform takes ~10–20%, agency takes a margin, contributor gets the residual.",
      ours: "Contributors keep 85% of contract revenue. The 15% house cut funds shared infrastructure — not shareholders.",
      accent: "magenta",
    },
    {
      old: "Direct contact info is a leak vector — clients and contributors both hide it to keep the door open for off-platform deals.",
      ours: "Admins scrub direct-contact info on the way out so contributors get attribution without becoming a circumvention target. PII removal is never a rejection — admins just remove it inline.",
      accent: "blue",
    },
    {
      old: "Each contributor pitches themselves cold. Quality of self-presentation drowns out quality of work.",
      ours: "Members submit objective fields — price, timeline, work samples. Admins author the positioning narrative consistently across every quote sheet so nobody undersells or overclaims themselves.",
      accent: "green",
    },
    {
      old: "When the contract closes, the relationship resets to zero. No equity, no compounding ownership.",
      ours: "Contributors accrue $BUILD tokens on every shipped contract. Real attribution, real co-ownership, real governance rights as you move up the membership tiers.",
      accent: "magenta",
    },
  ];

  const accentClass = {
    magenta: "text-brand-magenta",
    blue: "text-brand-blue",
    green: "text-brand-green",
  } as const;

  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          What we changed
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Concrete differences between the conventional freelance economy
          and the cooperative we built. Not rhetoric — pricing, policy, and
          plumbing.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
            >
              <div
                className={`text-xs uppercase tracking-wider ${accentClass[row.accent]}`}
              >
                Old model → ours
              </div>
              <div className="mt-3 text-sm text-ink-muted">
                <span className="text-ink-faint">Before:</span> {row.old}
              </div>
              <div className="mt-3 text-sm">
                <span className="text-ink-faint">Now:</span>{" "}
                <span className="text-ink">{row.ours}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CoreCompetencies() {
  // The competencies block mirrors Future Modern's agency-side
  // boilerplate. These aren't pillar marketing — they're the shipping
  // surfaces a client can request a team for.
  const groups: {
    label: string;
    color: string;
    skills: string[];
  }[] = [
    {
      label: "Technical",
      color: "#5070F0",
      skills: [
        "Web Design",
        "Web Development",
        "Blockchain Development",
        "Data Science & Machine Learning",
        "Mechanical Engineering",
        "Robotics",
        "Electrical Engineering",
        "Network Administration & Cybersecurity",
        "Scientific Liaison",
        "Technical Writing",
      ],
    },
    {
      label: "Creative",
      color: "#D828A0",
      skills: [
        "Content Marketing",
        "Advertising",
        "Music",
        "Product Design",
        "Graphic Design",
        "Game Design",
        "Fashion Design",
        "Film Direction",
        "Event Planning",
      ],
    },
    {
      label: "Business & Professional",
      color: "#007048",
      skills: [
        "Managed Services",
        "Product Management",
        "Consulting",
        "Strategy",
        "Psychiatry & Psychology",
        "Family Medicine",
        "Health Law",
        "Employment Law",
        "Pharmaceuticals",
        "Medical Writing",
      ],
    },
  ];

  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Core competencies
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          We leverage a one-of-a-kind interdisciplinary network to deliver
          best-in-class service to a small list of select clients. These are
          the surfaces we&apos;ve actually shipped for.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.label}
              className="rounded-2xl border border-t-4 border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
              style={{ borderTopColor: g.color }}
            >
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: g.color }}
              >
                {g.label}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-muted">
                {g.skills.map((s) => (
                  <li key={s} className="flex items-baseline gap-2">
                    <span
                      className="h-1 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Provenance() {
  const principles = [
    {
      title: "Provenance.",
      body:
        "Resources and acknowledgement flow back to original ideas and the labor that moves culture forward. Attribution is permanent and the ledger is public to the contributors on each engagement — nobody chases anyone for credit, and contributions compound across years.",
      accent: "magenta",
    },
    {
      title: "Discernment.",
      body:
        "We curate. The cooperative isn’t a marketplace of disconnected skills — admins frame contributors consistently, vet incoming RFPs, and assemble cross-pillar teams the way a good agency partner would. We create the wave that others ride.",
      accent: "blue",
    },
    {
      title: "Equity.",
      body:
        "Eighty-five percent of contract revenue flows to the people who shipped. $BUILD tokens accrue with contribution. Membership tiers map to governance rights. The platform is owned by the people building it — by design, not as a marketing claim.",
      accent: "green",
    },
    {
      title: "Truth and inquiry.",
      body:
        "We value freedom and responsibility of expression, alongside honesty, transparency, and experimentation. Where we’re unsure, we say so. Where we’re certain, we ship. The roadmap is public; the open frictions are too.",
      accent: "magenta",
    },
    {
      title: "Tried and true × cutting edge.",
      body:
        "We’re innovative in how we combine proven methods with new technology and strategy. We aren’t shipping a tech demo — we’re running an agency on top of a cooperative model and the engineering follows the operations, not the other way around.",
      accent: "blue",
    },
    {
      title: "Community as the operating system.",
      body:
        "Our community originally came together at the cutting edge of music and online culture. We aim to create a world where community integrates with life, art, appreciation, and passion — and the platform’s economics are tilted accordingly.",
      accent: "green",
    },
  ] as const;

  const accentClass = {
    magenta: "border-t-brand-magenta",
    blue: "border-t-brand-blue",
    green: "border-t-brand-green",
  } as const;

  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-xs uppercase tracking-wider text-brand-magenta">
            Core values
          </span>
        </div>
        <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
          Provenance · Discernment · Equity
        </h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          The non-negotiables. They&apos;re encoded in the product, not just
          the About page. Every engineering decision and every operations
          ritual gets measured against these.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {principles.map((p) => (
            <div
              key={p.title}
              className={`rounded-2xl border border-t-4 border-[var(--surface-border)] bg-[var(--surface)] p-6 ${accentClass[p.accent]}`}
            >
              <h3 className="font-display text-lg font-semibold text-ink">
                {p.title}
              </h3>
              <p className="mt-3 text-sm text-ink-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Credentials() {
  // Institutions and brands the cooperative's contributors cut their teeth
  // at. Sourced from Future Modern's agency boilerplate. Grouped roughly
  // by domain so the reader can scan to the part they care about.
  const groups: { label: string; items: string[]; color: string }[] = [
    {
      label: "Universities & research",
      color: "#5070F0",
      items: [
        "Caltech",
        "UChicago",
        "Duke",
        "UC Berkeley",
        "USC",
        "UCLA",
        "The Smithsonian",
      ],
    },
    {
      label: "Industry & engineering",
      color: "#007048",
      items: [
        "Microsoft",
        "Amazon",
        "Lenovo",
        "Align Technology",
        "Bird Rides",
        "Ontraport",
        "Los Angeles Department of Water & Power",
        "WebMD",
      ],
    },
    {
      label: "Music, media & culture",
      color: "#D828A0",
      items: [
        "Columbia Records",
        "Bad Boy Records",
        "Mad Decent Records",
        "Complex Magazine",
        "Lee Men’s Denim",
      ],
    },
  ];

  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Where the team cut its teeth
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          A non-exhaustive sample of the institutions, labs, and brands
          where Future Modern contributors have shipped serious work
          before joining the cooperative.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.label}
              className="rounded-2xl border border-l-4 border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
              style={{ borderLeftColor: g.color }}
            >
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: g.color }}
              >
                {g.label}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-ink">
                {g.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-xs text-ink-faint">
          Inclusion in this list reflects past and current affiliations of
          cooperative contributors. It is not an endorsement by any of these
          organizations of Future Modern Builderberg LLC or $BUILD.Store.
        </p>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Three pillars, one cooperative
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Every member sits in at least one pillar. Many sit across two. A
          handful move freely through all three. The pillar framing is how we
          route opportunities and how we build teams that can actually ship a
          Fortune-500-grade brief.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <PillarCard
            label="STEM"
            color="#5070F0"
            blurb="Full-stack engineering, AI/ML, blockchain, security, data, research."
          />
          <PillarCard
            label="Creative Media"
            color="#D828A0"
            blurb="Music, film, editorial, design, direction, post-production."
          />
          <PillarCard
            label="Professional Services"
            color="#007048"
            blurb="Strategy, legal, finance, operations, management consulting."
          />
        </div>

        <div className="mt-12 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-8 md:p-10">
          <p className="text-xs uppercase tracking-wider text-brand-magenta">
            The Future Modernist
          </p>
          <h3 className="mt-3 font-display text-2xl font-semibold md:text-3xl">
            A creator at heart — artist, engineer, builder.
          </h3>
          <p className="mt-4 max-w-3xl text-ink-muted">
            We have specialists, plenty of them. But the people who shape this
            cooperative are renaissance figures: comfortable directing a
            shoot in the morning, shipping a smart contract in the afternoon,
            sitting in a policy room that night. We&apos;re bringing back the
            apprenticeship-to-mastery arc the modern career path quietly
            killed — where a person isn&apos;t reduced to one job title, and
            depth in one craft sharpens the others.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <OriginNote
              eyebrow="Politics"
              color="#007048"
              body="The initial driver to connection. Shared conviction about who deserves access, who builds the rooms, who owns the upside."
            />
            <OriginNote
              eyebrow="Art"
              color="#D828A0"
              body="What led us, and what created our foundation. The cooperative formed around creative work before it ever formed around contracts."
            />
            <OriginNote
              eyebrow="Technology"
              color="#5070F0"
              body="Cutting-edge tooling — blockchain, AI, on-chain attribution — is what grew the brand from a circle of practitioners into a platform."
            />
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-sm text-ink-faint">
          This isn&apos;t a marketplace listing of disconnected skills.
          It&apos;s a cooperative that staffs cross-pillar teams the way a
          high-end agency would, with the economics owed to the people doing
          the work.
        </p>
      </div>
    </section>
  );
}

function OriginNote({
  eyebrow,
  color,
  body,
}: {
  eyebrow: string;
  color: string;
  body: string;
}) {
  return (
    <div
      className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-5"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <p
        className="text-[11px] uppercase tracking-wider"
        style={{ color }}
      >
        {eyebrow}
      </p>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </div>
  );
}

function PillarCard({
  label,
  color,
  blurb,
}: {
  label: string;
  color: string;
  blurb: string;
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6 transition-colors"
      style={{ borderTopColor: color, borderTopWidth: 4 }}
    >
      <div
        className="flex items-center gap-2 text-xs uppercase tracking-wider"
        style={{ color }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        Pillar
      </div>
      <h3 className="mt-2 font-display text-2xl font-semibold">{label}</h3>
      <p className="mt-3 text-sm text-ink-muted">{blurb}</p>
    </div>
  );
}

function RoadmapPeek() {
  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface-elevated)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="grid gap-10 md:grid-cols-[1fr,1.5fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">
              Where we&apos;re going
            </h2>
            <p className="mt-4 text-ink-muted">
              $BUILD.Store today is the working core of a larger Future Modern
              ecosystem. The roadmap is layered — sandbox first, then a real
              backend, then new product surfaces, then the parent domain.
            </p>
            <p className="mt-4 text-ink-muted">
              We aren&apos;t shy about what&apos;s built versus what&apos;s
              coming. The honest version lives in the project log.
            </p>
          </div>

          <div className="space-y-4">
            <RoadmapRow
              phase="Phase 0"
              status="In progress"
              statusColor="#5070F0"
              body="Sandbox polish. Member, admin, and public surfaces wired up over mock data so the experience is testable end-to-end before backend choices lock in."
            />
            <RoadmapRow
              phase="Phase 1"
              status="Next"
              statusColor="#D828A0"
              body="Real backend. Auth.js + Neon + Drizzle for persistence. RFP intake routes to email, HubSpot deal sync, Stripe Connect Express for payouts, attribution ledger, the 85/15 revenue split engine."
            />
            <RoadmapRow
              phase="Phase 2"
              status="After that"
              statusColor="#007048"
              body="New surfaces. The /store marketplace. Mux-hosted content locker for artists. Pre-launch whitelist of 1,000 invited members with structured feedback capture."
            />
            <RoadmapRow
              phase="Phase 3"
              status="On the horizon"
              statusColor="#5070F0"
              body="Future Modern parent domain at afuturemodern.com — marketing site, case studies, signals feed, ecosystem story. $BUILD.Store stays a first-class app inside the family."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function RoadmapRow({
  phase,
  status,
  statusColor,
  body,
}: {
  phase: string;
  status: string;
  statusColor: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink">
          {phase}
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${statusColor}26`,
            color: statusColor,
          }}
        >
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-muted">{body}</p>
    </div>
  );
}

function ConstellationSection() {
  return (
    <section className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-wider text-brand-magenta">
            Venture Labor OS
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            Eight interlocking systems.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-muted">
            Not a marketplace. An operating system for cooperative
            professional work. Every rail below is specified,
            implemented, and audit-logged. Hover any node to see how it
            connects.
          </p>
        </div>
        <VentureLaborConstellation />
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/governance"
            className="rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-4 py-2 text-brand-magenta hover:bg-brand-magenta/20"
          >
            Governance framework →
          </Link>
          <Link
            href="/policies/covenant"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
          >
            Cooperative Covenant →
          </Link>
          <Link
            href="/trust"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
          >
            Trust &amp; security →
          </Link>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-[var(--surface)]">
      <div className="mx-auto max-w-app px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Ready to be part of it?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          Whether you&apos;re a contributor looking for a fairer model or a
          client looking for a real team — start here.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-brand-magenta px-8 py-3 font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
          >
            Apply to join
          </Link>
          <Link
            href="/membership"
            className="inline-flex items-center justify-center rounded-full border border-brand-blue/60 px-8 py-3 font-medium text-brand-blue transition-colors hover:bg-brand-blue/10"
          >
            See membership tiers
          </Link>
          <a
            href="https://calendly.com/properpreparationism"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-8 py-3 font-medium text-ink transition-colors hover:bg-[var(--surface-elevated)]"
          >
            Talk to us
          </a>
        </div>
        <p className="mt-8 text-xs text-ink-faint">
          Future Modern Builderberg LLC · A cooperative talent platform.
        </p>
      </div>
    </section>
  );
}
