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
import { HomepageQuestionForm } from "@/components/HomepageQuestionForm";
import { ButtonLink, buttonClassName } from "@/components/Button";
import { ArrowDown, Check, Maximize2, X } from "lucide-react";
import { VentureLaborDiagram } from "@/components/VentureLaborDiagram";
import { DiagramZoom } from "@/components/DiagramZoom";
import { DiagramMobileViewer } from "@/components/DiagramMobileViewer";
import { Faq, type FaqItem } from "@/components/Faq";
import { TaglineRare } from "@/components/TaglineRare";
import { DefinedTermSchema } from "@/components/DefinedTermSchema";
import { getEntriesForPage } from "@/lib/glossary";
import { PUBLIC_BOOKING_CTA, PUBLIC_BOOKING_URL } from "@/lib/public-booking";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

/**
 * Static-rendered. No cookies, no headers, no dynamic search params —
 * this page can serve from the edge as cached HTML.
 */

export const metadata = {
  title: "About · $BUILD.Store",
  description:
    "The world's first Venture Labor Cooperative. Cash flows to the people who ship. Cooperatively owned, contribution-earned, member-governed. Future Modern.",
};

export default function AboutPage() {
  return (
    <>
      {/* DefinedTerm JSON-LD for every canonical term authoritatively
          defined on this page. Powers AEO/GEO citation ownership — see
          _memory/future-modern.md → SEO+AEO+GEO section and
          production-swap-checklist.md §7n1. */}
      <DefinedTermSchema
        entries={getEntriesForPage("/about")}
        pageUrl={`${SITE_URL}/about`}
      />
      <div className="bg-[#06070a]">
        <Hero />
        <WhyWeBuiltThis />
        <PeoplePowered />
        <Credentials />
        <VentureLabor />
        <ConstellationSection />
        <WhatChanged />
        <Provenance />
        <Pillars />
        <CoreCompetencies />
        <WhatWeSayNoTo />
        <RoadmapPeek />
        <FaqSection />
        <CTA />
      </div>
    </>
  );
}

function WhyWeBuiltThis() {
  const items = [
    { n: "01", text: "Real equity for the effort." },
    { n: "02", text: "Pay tied to what you deliver." },
    { n: "03", text: "Hours structured around the work, not the office." },
    { n: "04", text: "Recognition for what you shipped, not how you performed." },
  ];
  const comparisons = [
    { title: "Companies", range: "1 & 2", description: "Equity + pay. Not the rest.", equity: true, flexibility: false },
    { title: "Gig Platforms", range: "3 & 4", description: "Flexibility + results. Not the rest.", equity: false, flexibility: true },
    { title: "Future Modern", range: "All Four", description: "The whole deal, structurally.", equity: true, flexibility: true },
  ];

  return (
    <section id="our-story" className="scroll-mt-24">
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <p className="text-xs uppercase tracking-wider text-brand-magentaText">Background</p>
        <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">Why we built this</h2>
        <p className="mt-4 text-lg text-ink-muted md:text-xl">Every worker knows the deal worth staying for.</p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.n} className="relative flex min-h-28 items-center overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 md:min-h-32 md:p-8">
              <span aria-hidden="true" className="pointer-events-none absolute -left-4 top-1/2 -translate-y-1/2 bg-gradient-to-br from-brand-blue to-brand-magenta bg-clip-text font-display text-[clamp(80px,10vw,140px)] font-bold leading-none text-transparent opacity-[0.12]">{item.n}</span>
              <span className="relative text-base font-medium leading-relaxed text-ink">{item.text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {comparisons.map((item) => (
            <div key={item.title} className={`flex min-h-60 flex-col justify-between rounded-2xl border bg-[var(--surface)] p-6 ${item.title === "Future Modern" ? "border-brand-magenta/70" : "border-[var(--surface-border)]"}`}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.title === "Future Modern" ? "bg-gradient-to-r from-brand-blue to-brand-magenta text-white" : "bg-white/5 text-ink-muted"}`}>{item.range}</span>
                </div>
                <p className="mt-4 leading-relaxed text-ink-muted">{item.description}</p>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {[["Equity & Pay", item.equity], ["Flexible Hours & Results", item.flexibility]].map(([label, included]) => (
                  <li key={String(label)} className={`flex items-center gap-2 ${included ? "text-ink" : "text-ink-muted"}`}>
                    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${included ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400" : "border-brand-magenta/30 bg-brand-magenta/15 text-brand-magentaText"}`}>
                      {included ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
                    </span>
                    <span>{label}<span className="sr-only"> {included ? "included" : "not included"}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-xl italic text-ink-muted">&ldquo;We looked. We couldn&apos;t find it. So we built it.&rdquo;</p>
          <p className="mt-3 text-lg font-medium text-ink">If it&apos;s the deal you&apos;ve been waiting for, the door is open.</p>
        </div>
      </div>
    </section>
  );
}

/**
 * About-page FAQ — deeper cooperative questions. Different set than
 * the landing-page FAQ (which is objection-handling for browsers);
 * this one is for readers already curious about the model.
 */
function FaqSection() {
  const items: FaqItem[] = [
    {
      question: "What does \"cooperative\" mean for Future Modern in practice?",
      answer:
        "Every Member has one voice in governance. Cash flow follows the work. The people doing the shipping keep the largest share of every engagement. Standing is earned through peer-reviewed contribution, not bought, gamed, or inherited.\n\nThe LLC is the legal wrapper. The cooperative is the operating agreement inside it. Both are documented. The Cooperative Covenant is the plain-English version. The operating agreement is the legal one.",
    },
    {
      question: "Who owns the platform?",
      answer:
        "Members do. Governance weight tracks the annual canonization each Member mints: an ERC-721 with an ERC-6551 token-bound account that carries their standing for that year. Members vote on covenant changes, subprocessor decisions, and major direction shifts.\n\nFuture Modern is the operator. The builders are the owners.",
    },
    {
      question: "How does someone become a Member?",
      answer:
        "The default path is contribution first, membership later. Prospects show up on a project, ship the work, get peer-reviewed, and (if the standing is real) get invited into full Membership. Partners can join as co-delivery collaborators without full Membership if the fit is scoped that way.\n\nAll of it runs through the whitelist. Every addition is a considered choice, not an application-form gauntlet.",
    },
    {
      question: "What's the relationship to Web3?",
      answer:
        "Web3-native by architecture, not by aesthetic. The canonization system runs on ERC-721 + ERC-6551 so Members hold portable, on-chain proof of standing. The publishing rail is Paragraph (Web3-native writing infrastructure) rather than a self-hosted blog. Contribution history is designed to be verifiable end-to-end.\n\nNone of this is required for clients. You can hire the cooperative without touching a wallet. But if you care how provenance works under the surface, the receipts are on-chain.",
    },
    {
      question: "Where can I read more?",
      answer:
        "The Cooperative Covenant at /policies/covenant is the operating charter. The Venture Labor OS constellation at /governance is the system diagram. Long-form pieces live at /articles (piped from paragraph.com/@future-modern). The Trust & Security page at /trust is the procurement-facing summary.",
    },
  ];

  return (
    <div id="questions" className="scroll-mt-24 [&>section]:border-0 [&>section]:bg-transparent">
      <Faq
        eyebrow="Common questions"
        heading="Questions the cooperative gets asked"
        items={items}
        aside={<HomepageQuestionForm />}
      />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-app px-6 pb-10 pt-16 md:pb-12 md:pt-24">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-greenText">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
              About Future Modern
            </div>
            <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">
              The world&apos;s first{" "}
              <span className="bg-gradient-to-r from-brand-magenta to-brand-blue bg-clip-text text-transparent">
                Venture Labor Cooperative
              </span>.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-muted md:text-xl">
              Future Modern is a cooperative talent agency operating at the intersection
              of art, tech and culture to deliver creative strategy, managed services,
              and labor solutions through a nexus of 1,000+ members and partners, many
              with Unicorn startup, FAANG, and Fortune 500 experience.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              Read on to see how we work with clients, and how members earn theirs.
            </p>
            <a href="#our-story" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand-blue underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue">
              Explore the story <ArrowDown aria-hidden="true" size={16} />
            </a>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-6 sm:p-8">
            <p className="font-display text-xl leading-snug text-ink md:text-2xl">
              We&apos;re not trying to be special. We are special. We don&apos;t care if anyone sees it.
            </p>
            <ul className="mt-6 space-y-3 border-t border-[var(--surface-border)] pt-6 text-sm leading-relaxed text-ink-muted">
              <li className="flex items-start gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-magenta" />Turning workers into owners</li>
              <li className="flex items-start gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />People-powered, exclusively</li>
              <li className="flex items-start gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" />Access is earned, not sold</li>
            </ul>
          </div>
        </div>
        <nav aria-label="About page sections" className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--surface-border)] pt-5 text-sm text-ink-muted">
          <a className="hover:text-ink focus-visible:text-ink" href="#people">Our people</a>
          <a className="hover:text-ink focus-visible:text-ink" href="#model">Our model</a>
          <a className="hover:text-ink focus-visible:text-ink" href="#expertise">Our expertise</a>
          <a className="hover:text-ink focus-visible:text-ink" href="#standards">Our standards</a>
          <a className="hover:text-ink focus-visible:text-ink" href="#questions">Questions</a>
        </nav>
      </div>
    </section>
  );
}

// PurposeVision removed 2026-07-10. The "The wave others ride" +
// "Capital, redistributed" framing was internal-adjacent language —
// abstract and closer to ideological signaling than to the mechanic-
// driven customer-first posture. WhyWeBuiltThis (the numbered-deal
// synthesis) now carries the purpose statement immediately after the
// hero. If a Rare∞ tagline moment is wanted back on /about, it can
// live as its own standalone Tagline section — direct me on
// placement when that decision is made.

function PeoplePowered() {
  return (
    <section id="people" className="scroll-mt-24">
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <div className="space-y-12">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-greenText">
              People-powered, exclusively
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              The resumes speak for themselves.
            </h2>
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)] lg:gap-12">
            <div className="max-w-prose space-y-5 leading-relaxed text-ink-muted">
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
                wasn&apos;t the issue. Fit was. The pattern was the same
                every time: vindication afterwards. The people who built
                Future Modern are the ones who keep moving when the room
                they&apos;re in stops being big enough for what they
                actually do.
              </p>
              <p>
                None of our clients came from freelance platforms. Anything
                visible there is a testament to who we are, not a credential
                we&apos;re trading on. Our work has always come through
                relationships. Through the people who&apos;ve seen us
                deliver and stayed in the room.
              </p>
            </div>
            <blockquote className="relative self-start overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-7 md:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 bg-[url('/brand/turtle.png')] bg-contain bg-no-repeat opacity-[0.05] grayscale" />
              <p className="relative font-display text-xl leading-relaxed text-ink md:text-2xl">
                $BUILD.Store is the platform we built so the next generation
                of that talent doesn&apos;t have to leave a half-dozen
                companies to be paid what their work is worth. The
                cooperative is the structure. The people are the proof.
              </p>
            </blockquote>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-brand-greenText">What &quot;people-powered&quot; means</p>
            <h3 className="mt-2 font-display text-2xl font-semibold">Earned, not bought</h3>
            <ul className="mt-6 grid gap-4 leading-relaxed text-ink-muted sm:grid-cols-2">
              <li className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
                <span className="text-ink">Earned, not bought.</span>{" "}
                Access is earned through invitation, application and vetting,
                or contribution to the cooperative&apos;s infrastructure. The
                whitelist is not for sale.
              </li>
              <li className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
                <span className="text-ink">Admin-authored framing.</span>{" "}
                Members submit objective fields: price, timeline, work
                samples. The cooperative authors positioning so the work
                speaks for itself.
              </li>
              <li className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
                <span className="text-ink">85% to the people who shipped.</span>{" "}
                Eighty-five percent of all client revenue goes directly to the
                member teams who delivered the work.
              </li>
              <li className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
                <span className="text-ink">Attribution is permanent.</span>{" "}
                The ledger compounds across years. Contributions do not
                reset to zero when a contract closes.
              </li>
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-ink-muted">
              We don&apos;t curate around credentials. We curate around
              people who&apos;ve done the work and care about doing it
              right.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function VentureLabor() {
  return (
    <section id="model" className="scroll-mt-24">
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <div className="grid items-start gap-8 leading-relaxed lg:grid-cols-2 lg:gap-12">
          <div className="max-w-prose">
            <div className="text-xs uppercase tracking-wider text-brand-magentaText">
              The contract
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              We call this Venture Labor.
            </h2>
            <p className="mt-5 text-ink-muted">
              Venture Capital pools money and goes looking for labor to
              multiply it. Venture Labor is the inversion. Skilled labor pools
              its time and effort, and the upside on what gets shipped belongs
              to the people who shipped it.
            </p>
            <p className="mt-4 text-ink-muted">
              The phrase is honest about where we came from. Patrons
              used to buy into an artist&apos;s work to keep it moving
              until it sold. The tradition is old, and the controls
              around it were historically lazy: no point-of-sale
              discipline, contracts that read like favors, profit
              conversations that did not happen until the money was
              already gone. We kept the underlying idea and fixed the
              controls. We understand that workers are creating the value and
              deserve the upside of their contributions.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 md:p-8 lg:mt-8">
            <p className="text-sm font-medium text-brand-magentaText">The vetting bar</p>
            <h3 className="mt-2 font-display text-2xl font-semibold">
              Ideological as much as technical.
            </h3>
            <div aria-hidden="true" className="mt-5 flex items-center gap-3 text-xs font-medium text-ink-muted">
              <span className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2">Craft</span>
              <svg className="min-w-8 max-w-20 flex-1" viewBox="0 0 80 8" fill="none"><path d="M0 4H80" stroke="var(--fm-magenta-text)" strokeWidth="1.5" opacity=".6" /></svg>
              <span className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2">Values</span>
            </div>
            <p className="mt-4 leading-relaxed text-ink-muted">
              The failure of pooled labor is not lack of talent, but talented
              people who disregard the agreement the moment a check clears.
              We vet for that first. The craft we can teach.
              The values we cannot, and we have stopped trying.
            </p>
            <p className="mt-4 border-l-2 border-brand-magenta/40 pl-4 text-sm italic leading-relaxed text-ink-muted">
              Anyone who can&apos;t handle money, in the sense that
              they throw out all ideals for it, is not one of us. We
              don&apos;t care how good they are.
            </p>
          </div>
        </div>

        <VentureLaborOverview />
      </div>
    </section>
  );
}

function VentureLaborOverview() {
  const parts = [
    { name: "Contributor", detail: "Skills · Relationships · Domain expertise" },
    { name: "Platform", detail: "Infrastructure · Brand · Distribution · Leverage" },
    { name: "Client / deal", detail: "Revenue generated · 85% to direct labor" },
    { name: "Treasury", detail: "Cooperative operations · Shared infrastructure" },
    { name: "Liquidity pool / $BUILD token", detail: "Passive equity accrual · OTC mobilization" },
  ];
  const flows = [
    ["Contributor → Venture Labor OS", "Deal flow"],
    ["Venture Labor OS → Contributor", "Cash / equity"],
    ["Contributor → Platform", "Platform leverage"],
    ["Venture Labor OS → Platform", "Platform leverage"],
    ["Platform ↔ Client / deal", "Platform relationship"],
    ["Venture Labor OS ↔ Client / deal", "Deal flow and cash"],
    ["Client / deal → Treasury", "Cash payment"],
    ["Treasury → Liquidity pool", "Treasury flow"],
    ["Liquidity pool → Contributor", "Cash / equity"],
    ["Venture Labor OS ↔ Treasury", "Reinvestment feedback"],
    ["Venture Labor OS ↔ Liquidity pool", "Feedback loop"],
  ];
  return (
    <figure className="mt-12 overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
      <figcaption className="relative border-b border-[var(--surface-border)] px-6 py-6 sm:px-8">
        <div className="sm:pr-52">
          <p className="text-sm font-medium text-brand-magentaText">Venture Labor OS</p>
          <h3 className="mt-2 font-display text-2xl font-semibold md:text-3xl">How the system connects</h3>
          <p className="mt-3 max-w-3xl leading-relaxed text-ink-muted">The contributors, platform, client, treasury, and liquidity pool connected through Venture Labor.</p>
        </div>
        <DiagramMobileViewer><VentureLaborDiagram /></DiagramMobileViewer>
        <details open className="group hidden sm:block">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--surface-border)] px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand-magenta/60 hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue sm:absolute sm:right-8 sm:top-6 [&::-webkit-details-marker]:hidden">
            <Maximize2 size={16} aria-hidden="true" />
            <span className="group-open:hidden">View diagram</span>
            <span className="hidden group-open:inline">Hide diagram</span>
          </summary>
          <div className="mt-6">
            <DiagramZoom><VentureLaborDiagram /></DiagramZoom>
          </div>
        </details>
      </figcaption>
      <div className="relative bg-[var(--surface)] px-6 pb-6 pt-6 sm:px-8">
        <div className="relative z-10 mx-auto w-fit rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-5 py-3 text-center font-display text-lg font-semibold text-ink">Venture Labor OS</div>
        <svg aria-hidden="true" className="pointer-events-none absolute left-[10%] top-12 hidden h-24 w-[80%] lg:block" viewBox="0 0 1000 64" preserveAspectRatio="none" fill="none">
          <path d="M500 0 V18 M0 64 V48 Q0 32 20 32 H980 Q1000 32 1000 48 V64 M250 32 V64 M500 18 V64 M750 32 V64" stroke="var(--fm-blue-text)" strokeWidth="1.5" opacity="0.55" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-5">
        {parts.map((part) => (
          <div key={part.name} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] px-4 py-5">
            <h4 className="font-display text-lg font-semibold text-ink">{part.name}</h4>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{part.detail}</p>
          </div>
        ))}
        </div>
      </div>
      <div className="border-t border-[var(--surface-border)] px-6 py-6 sm:px-8">
        <p className="text-sm font-medium text-ink">Connections and flows</p>
        <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {flows.map(([connection, flow]) => (
            <li key={connection} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--surface-border)] pb-3 text-sm leading-relaxed">
              <span className="text-ink">{connection}</span><span className="text-ink-muted">{flow}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function WhatChanged() {
  const rows: { old: string; ours: string; accent: "magenta" | "blue" | "green" }[] = [
    {
      old: "Platform takes ~10–20%, agency takes a margin, contributor gets the residual.",
      ours: "Contributors keep 85% of contract revenue. The 15% house cut funds shared infrastructure, not outside shareholders.",
      accent: "magenta",
    },
    {
      old: "Direct contact info is a leak vector. Clients and contributors both hide it to keep the door open for off-platform deals.",
      ours: "Information is gated until engagement begins. Contributors get attribution without becoming a circumvention target.",
      accent: "blue",
    },
    {
      old: "Each contributor pitches themselves cold. Quality of self-presentation drowns out quality of work.",
      ours: "Members submit objective fields: price, timeline, work samples. Executive Strategists author the positioning narrative consistently and honestly.",
      accent: "green",
    },
    {
      old: "Bidding platforms extract from both sides. Workers pay to be seen. Clients wade through 50+ proposals to find 3-5 matches.",
      ours: "No bidding. No pay for access. The cooperative curates 3-5 qualified matches per skillset. Workers stay in delivery mode.",
      accent: "blue",
    },
    {
      old: "When the contract closes, the relationship resets to zero. No equity, no compounding ownership.",
      ours: "Contributors accrue $BUILD tokens on every shipped contract. Real attribution, real co-ownership, and real governance.",
      accent: "magenta",
    },
  ];


  return (
    <section>
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          What we changed
        </h2>
        <p className="mt-2 text-ink-muted">
          Concrete differences between the conventional freelance economy
          and the cooperative we built. Not rhetoric. Pricing, policy, and
          plumbing.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <div className="hidden grid-cols-2 border-b border-[var(--surface-border)] bg-[var(--surface-inset)] text-sm font-medium sm:grid">
            <span className="px-4 py-4 sm:px-6">Before</span>
            <span className="border-l border-[var(--surface-border)] px-4 py-4 text-brand-magentaText sm:px-6">Now</span>
          </div>
          {rows.map((row) => (
            <div key={row.old} className="grid grid-cols-1 border-b border-[var(--surface-border)] last:border-b-0 sm:grid-cols-2">
              <div className="px-4 py-5 leading-relaxed text-ink-muted sm:px-6">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted sm:hidden">Before</span>
                {row.old}
              </div>
              <div className="border-t border-[var(--surface-border)] bg-[var(--surface-inset)] px-4 py-5 leading-relaxed text-ink sm:border-l sm:border-t-0 sm:px-6">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-brand-magentaText sm:hidden">Now</span>
                {row.ours}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * What we say no to — the refusals as identity.
 *
 * Jamar's insight 2026-07-10: "realizing what we say no to is the real
 * value here." FM's identity is built more on the discipline of refusal
 * than on any positive value prop. The 85%, the curation, the token,
 * the constellation are all consequences; the refusals are the cause.
 * Steve Jobs' "focusing is about saying no" + Nassim Taleb's via
 * negativa are the closest precedents. Locked as the meta-principle in
 * `future-modern.md` → Brand voice → "The Refusals."
 *
 * Placed between Credentials and WhatChanged so the pattern is named
 * before the concrete trade-off rows are shown. Reads harder than a
 * positive value prop because every American operator has heard the
 * yes-list before; almost none have heard the no-list said out loud
 * with confidence.
 *
 * Sales-posture nuance (locked 2026-07-23): the sales-refusal card names
 * deceptive tactics, not sales itself. Jamar's long-game is a serious
 * sales org — positioning as anti-sales boxes that in. The card refuses
 * fake urgency, bait-and-switch, opaque pricing. Not selling. Also swaps
 * "honest timelines" for "honest tracking" — Builders own their delivery
 * commitments in the cooperative model, FM manages the relationship and
 * the transparent milestone tracker; promising delivery hits would
 * overclaim structural control FM doesn't have.
 */
function WhatWeSayNoTo() {
  const refusals = [
    "No pay for access. Membership is earned by contribution, not cash.",
    "No paid tiers. Every member owns their own rate.",
    "No sponsored listings. Curation isn't an auction.",
    "No boosted profiles. Merit isn't a line item.",
    "No selling user's personal data. Trust is not a revenue stream.",
    "No sales theater. Honest pricing, honest tracking, honest scope. Every time.",
    "No exit strategy. Ownership is permanent by design.",
    "No discounts. Value is set by the creator, not haggled by the buyer.",
    "No confusion about compensation. The split is published before the work starts.",
  ];

  return (
    <section id="standards" className="scroll-mt-24 relative overflow-hidden">
      <div className="relative mx-auto max-w-app px-6 py-12 md:py-14">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-magentaText">
          The discipline
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
          What we say no to.
        </h2>
        <p className="mt-4 text-ink-muted">
          Every refusal below is a discipline. The refusals produce the
          outcomes. Take one away and the model breaks.
        </p>

        <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {refusals.map((r) => (
            <li
              key={r}
              className="border-t border-[var(--surface-border)] pt-4"
            >
              <span className="text-lg font-medium text-ink">{r}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm leading-relaxed text-ink-muted">
          We cold pitch to get in the door. We don&apos;t cold close.
          That&apos;s the whole difference.
        </p>
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
      color: "var(--fm-blue-text)",
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
      color: "var(--fm-magenta-text)",
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
      color: "var(--fm-green-text)",
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
    <section>
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Core competencies
        </h2>
        <p className="mt-2 text-ink-muted">
          We leverage a one-of-a-kind interdisciplinary network to deliver
          best-in-class service to a small list of select clients. These are
          the surfaces we&apos;ve actually shipped for.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.label}
              className="min-w-0 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 sm:p-6"
            >
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: g.color }}
              >
                {g.label}
              </div>
              <ul className="mt-4 space-y-2 leading-relaxed text-ink-muted">
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
        "Resources and acknowledgement flow back to original ideas and the labor that moves culture forward. Attribution is permanent.",
      accent: "magenta",
    },
    {
      title: "Discernment.",
      body:
        "Future Modern curates contributors, vets incoming RFPs, and assembles cross-pillar teams the way a strong agency partner would.",
      accent: "blue",
    },
    {
      title: "Equity.",
      body:
        "Eighty-five percent of contract revenue flows to the people who shipped. $BUILD tokens accrue with contribution. The platform is owned by the people building it.",
      accent: "green",
    },
    {
      title: "Truth and inquiry.",
      body:
        "Where we are unsure, we say so. Where we are certain, we ship.",
      accent: "magenta",
    },
    {
      title: "Tried and true × cutting edge.",
      body:
        "Future Modern combines proven operations with new technology and strategy. The engineering follows the operations, not the other way around.",
      accent: "blue",
    },
    {
      title: "Community as the operating system.",
      body:
        "Our community originally came together at the cutting edge of music and online culture. We aim to create a world where community integrates with life, art, appreciation, and passion. The platform’s economics are tilted accordingly.",
      accent: "green",
    },
  ] as const;

  return (
    <section>
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-xs uppercase tracking-wider text-brand-magentaText">
            Core values
          </span>
        </div>
        <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
          Provenance · Discernment · Equity
        </h2>
        <p className="mt-3 text-ink-muted">
          The non-negotiables. They&apos;re encoded in the product, not just
          the About page. Every engineering decision and every operations
          ritual gets measured against these.
        </p>

        <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {principles.map((p) => (
            <div
              key={p.title}
              className="border-t border-[var(--surface-border)] pt-5"
            >
              <h3 className="font-display text-lg font-semibold text-ink">
                {p.title}
              </h3>
              <p className="mt-3 leading-relaxed text-ink-muted">{p.body}</p>
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
      color: "var(--fm-blue-text)",
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
      color: "var(--fm-green-text)",
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
      color: "var(--fm-magenta-text)",
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
    <section>
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Where the team cut its teeth
        </h2>
        <p className="mt-2 text-ink-muted">
          A non-exhaustive sample of the institutions, labs, and brands
          where Future Modern contributors have shipped serious work
          before joining the cooperative.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.label}
              className="min-w-0"
            >
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: g.color }}
              >
                {g.label}
              </div>
              <ul className="mt-4 flex flex-wrap gap-2 text-sm leading-relaxed text-ink">
                {g.items.map((item) => (
                  <li key={item} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-ink-faint">
          Inclusion in this list reflects past and current affiliations of
          cooperative contributors. It is not an endorsement by any of these
          organizations of Future Modern or $BUILD.Store.
        </p>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section id="expertise" className="scroll-mt-24">
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Three pillars, one cooperative
        </h2>
        <p className="mt-2 text-ink-muted">
          Every member sits in at least one pillar. Many sit across two. A
          handful move freely through all three. The pillar framing is how
          opportunities are routed and how teams are built for serious briefs.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <PillarCard
            label="STEM"
            color="#5070F0"
            blurb="Full-stack engineering, AI/ML, blockchain, security, data, research, and more."
          />
          <PillarCard
            label="Creative Media"
            color="#D828A0"
            blurb="Music, film, editorial, design, direction, post-production, and more."
          />
          <PillarCard
            label="Professional Services"
            color="#007048"
            blurb="Strategy, legal, finance, operations, management consulting, and more."
          />
        </div>

        <div className="mt-12 border-t border-[var(--surface-border)] pt-8">
          <p className="text-xs uppercase tracking-wider text-brand-magentaText">
            The Future Modernist
          </p>
          <h3 className="mt-3 font-display text-2xl font-semibold md:text-3xl">
            A creator at heart. Artist, engineer, builder.
          </h3>
          <p className="mt-4 text-ink-muted">
            We have specialists, plenty of them. But the people who shape this
            cooperative are renaissance figures: comfortable directing a
            shoot in the morning, shipping a smart contract in the afternoon,
            sitting in a policy room that night. We&apos;re bringing back the
            apprenticeship-to-mastery arc the modern career path quietly
            killed. Where a person isn&apos;t reduced to one job title, and
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
              body="Cutting-edge tooling (blockchain, AI, on-chain attribution) is what grew the brand from a circle of practitioners into a platform."
            />
          </div>
        </div>

        <p className="mt-8 text-sm text-ink-faint">
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
    <div className="min-w-0">
      <p
        className="text-[11px] uppercase tracking-wider"
        style={{ color }}
      >
        {eyebrow}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
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
    <div className="border-t border-[var(--surface-border)] pt-5">
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
      <p className="mt-3 leading-relaxed text-ink-muted">{blurb}</p>
    </div>
  );
}

function RoadmapPeek() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-app px-6 py-12 md:py-14">
        <div className="grid gap-14 md:grid-cols-[1fr,1.7fr]">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-magentaText">
              Access, in phases
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold md:text-5xl">
              Where we&apos;re going
            </h2>
            <p className="mt-6 text-ink-muted">
              Access opens in three phases. The cooperative is
              intentional about who joins when. Earlier phases are
              denser signal. Later phases scale wider.
            </p>
            <p className="mt-4 text-ink-muted">
              Right now the whitelist is open. If you want a seat before
              the doors widen, that&apos;s the door.
            </p>
          </div>

          <div className="relative">
            <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-7 h-[calc(100%-3.5rem)] w-14" viewBox="0 0 56 400" preserveAspectRatio="none" fill="none">
              <path d="M25 0 C8 65 45 135 27 200 S9 335 25 400" stroke="var(--fm-blue-text)" strokeWidth="1.5" opacity="0.55" vectorEffect="non-scaling-stroke" />
              <path d="M28 0 C12 65 48 135 30 200 S12 335 28 400" stroke="var(--fm-magenta-text)" strokeWidth="1.5" opacity="0.5" vectorEffect="non-scaling-stroke" />
              <path d="M31 0 C15 65 51 135 33 200 S15 335 31 400" stroke="var(--fm-green-text)" strokeWidth="1.5" opacity="0.6" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="space-y-6">
              <RoadmapRow
                number="01"
                phase="Landing + whitelist"
                status="Open now"
                accent="#007048"
                body="Landing page live. Whitelist open to founding candidates who want a seat before the doors widen. First look at the cooperative model, first access to the invite pool."
              />
              <RoadmapRow
                number="02"
                phase="Open Beta"
                status="Next"
                accent="#D828A0"
                body="Selected cohort operates the platform end-to-end. Real contracts, real payouts, real recognition rails firing. Feedback from this window shapes the ship for public rollout."
              />
              <RoadmapRow
                number="03"
                phase="$BUILD.Store rollout"
                status="On the horizon"
                accent="#5070F0"
                body="The full platform open to everyone who came in through the ladder. Invited, applied, or contributed. The cooperative running at scale."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoadmapRow({
  number,
  phase,
  status,
  accent,
  body,
}: {
  number: string;
  phase: string;
  status: string;
  accent: string;
  body: string;
}) {
  return (
    <div className="relative pl-16">
      {/* Numbered disc on the spine */}
      <div
        className="absolute left-0 top-0 flex h-14 w-14 items-center justify-center rounded-full border-2 font-display text-lg font-bold"
        style={{
          borderColor: accent,
          color: accent,
          backgroundColor: "var(--surface)",
        }}
      >
        {number}
      </div>
      {/* Card */}
      <div
        className="border-t border-[var(--surface-border)] pt-4"
        style={{
          borderColor: `${accent}55`,
        }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div
            className="font-display text-lg font-semibold tracking-tight"
            style={{ color: accent }}
          >
            {phase}
          </div>
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{
              borderColor: accent,
              color: accent,
            }}
          >
            {status}
          </span>
        </div>
        <p className="mt-3 leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  );
}

function ConstellationSection() {
  return (
    <section>
      <div className="mx-auto max-w-app px-6 py-12 md:py-14">
        <div>
          <div className="text-sm font-medium text-brand-magentaText">
            Venture Labor OS
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            Owners ship better work than renters.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted md:text-xl">
            The upside on the work belongs to the people who shipped it.
            Provenance, Discernment, Equity.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-4 text-base font-medium">
          <Link
            href="/governance"
            className="text-brand-magentaText underline-offset-4 hover:underline"
          >
            See how the network works →
          </Link>
          <Link
            href="/policies/covenant"
            className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Cooperative Covenant →
          </Link>
          <Link
            href="/trust"
            className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
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
    <section className="relative isolate overflow-hidden bg-[var(--surface-inset)]">
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -left-32 h-[28rem] w-[28rem] bg-[url('/brand/turtle.png')] bg-contain bg-no-repeat opacity-[0.06] grayscale motion-safe:transition-opacity" />
      <div className="relative mx-auto max-w-app px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
            Ready to be part of it?
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Apply to join or build a team, learn about membership, or talk
            with us to find out more.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="flex h-full flex-col items-start rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 transition-transform duration-200 motion-safe:hover:-translate-y-1">
            <p className="font-display text-xl font-semibold">Join or build a team</p>
            <p className="mt-2 flex-1 leading-relaxed text-ink-muted">Apply to contribute your skills or find the right team for your project.</p>
            <ButtonLink href="/signup" variant="primary" size="large" className="mt-6">Apply to join</ButtonLink>
          </div>
          <div className="flex h-full flex-col items-start rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 transition-transform duration-200 motion-safe:hover:-translate-y-1">
            <p className="font-display text-xl font-semibold">Explore membership</p>
            <p className="mt-2 flex-1 leading-relaxed text-ink-muted">Learn about the different membership tiers.</p>
            <ButtonLink href="/membership" variant="secondary" size="large" className="mt-6">See membership tiers</ButtonLink>
          </div>
          <div className="flex h-full flex-col items-start rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 transition-transform duration-200 motion-safe:hover:-translate-y-1">
            <p className="font-display text-xl font-semibold">Talk with us</p>
            <p className="mt-2 flex-1 leading-relaxed text-ink-muted">Have questions? Schedule a call to learn more about Future Modern.</p>
            <a href={PUBLIC_BOOKING_URL} target="_blank" rel="noreferrer" className={buttonClassName({ variant: "secondary", size: "large", className: "mt-6" })}>{PUBLIC_BOOKING_CTA}</a>
          </div>
        </div>
        <p className="mt-8 text-sm text-ink-muted">Future Modern · A cooperative talent platform.</p>
      </div>
    </section>
  );
}
