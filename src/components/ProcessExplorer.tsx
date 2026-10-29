"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign, FileText, ListChecks, Users } from "lucide-react";

const stages = [
  {
    number: "01",
    accent: "green",
    title: "Tell us your project",
    body: "Submit your RFP and budget. Our automated matcher narrows the field within the zone of possible agreement.",
    visualTitle: "A brief with the essentials in view",
    visualItems: ["Goals and deliverables", "Budget and timeline", "The people involved"],
    detail: ["The request is made concrete.", "The budget sets viable options.", "The project is ready for review."],
    Icon: FileText,
  },
  {
    number: "02",
    accent: "blue",
    title: "Choose from 3–5 options",
    body: "Not a flood of resumes. A curated set of qualified member teams, skill-filtered to your project.",
    visualTitle: "A focused, relevant shortlist",
    visualItems: ["Relevant skills", "Working approach", "Availability and fit"],
    detail: ["Three to five qualified options.", "Skills are matched to the brief.", "The client chooses who leads."],
    Icon: Users,
  },
  {
    number: "03",
    accent: "magenta",
    title: "Pick your lead, stay in the loop",
    body: "Once awarded, the team runs delivery with DAO-style autonomy. You track milestones in real time.",
    visualTitle: "Delivery remains easy to follow",
    visualItems: ["Kickoff confirmed", "Milestones visible", "Updates tied to work"],
    detail: ["A lead team is in place.", "Milestones keep work visible.", "Updates stay tied to delivery."],
    Icon: ListChecks,
  },
  {
    number: "04",
    accent: "gold",
    title: "Revenue settles, tokens flow",
    body: "When revenue is collected, cash splits and $BUILD tokens distribute automatically to the crew.",
    visualTitle: "Closeout is recorded clearly",
    visualItems: ["Work confirmed", "Revenue collected", "Distribution recorded"],
    detail: ["The work is confirmed.", "Revenue is collected.", "Distribution is recorded."],
    Icon: CircleDollarSign,
  },
] as const;

const accents = {
  green: {
    border: "border-t-brand-green",
    text: "text-brand-greenText",
    marker: "bg-brand-green",
    soft: "bg-brand-green/10",
  },
  blue: {
    border: "border-t-brand-blue",
    text: "text-brand-blueText",
    marker: "bg-brand-blue",
    soft: "bg-brand-blue/10",
  },
  magenta: {
    border: "border-t-brand-magenta",
    text: "text-brand-magentaText",
    marker: "bg-brand-magenta",
    soft: "bg-brand-magenta/10",
  },
  gold: {
    border: "border-t-brand-gold",
    text: "text-brand-goldText",
    marker: "bg-brand-gold",
    soft: "bg-brand-gold/10",
  },
} as const;

export function ProcessExplorer() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const active = stages[activeIndex];
  const accent = accents[active.accent];
  const Icon = active.Icon;

  useEffect(() => {
    if (isInteracting) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % stages.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [isInteracting]);

  return (
    <div
      className="mt-10"
      onPointerEnter={() => setIsInteracting(true)}
      onPointerLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsInteracting(false);
        }
      }}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="How Future Modern works">
        {stages.map((stage, index) => {
          const isActive = index === activeIndex;
          const stageAccent = accents[stage.accent];

          return (
            <button
              key={stage.number}
              id={`process-tab-${stage.number}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="process-detail"
              onClick={() => setActiveIndex(index)}
              className={`relative min-h-48 overflow-hidden rounded-2xl border border-t-4 border-[var(--surface-border)] bg-[var(--surface)] p-6 text-left transition-[transform,border-color,background-color] duration-300 ease-out motion-reduce:transition-none ${stageAccent.border} ${isActive ? "-translate-y-1 bg-[var(--surface-elevated)]" : "hover:-translate-y-0.5 hover:bg-[var(--surface-elevated)]"}`}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-3 -top-5 bg-gradient-to-br from-brand-magenta to-brand-blue bg-clip-text font-display text-[clamp(5rem,10vw,8.75rem)] font-bold leading-none text-transparent opacity-[0.12]"
              >
                {stage.number}
              </span>
              <span className="relative z-10 block">
                <span className="block text-lg font-semibold text-ink">{stage.title}</span>
                <span className="mt-2 block text-sm leading-relaxed text-ink-muted">{stage.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section
        id="process-detail"
        role="tabpanel"
        aria-labelledby={`process-tab-${active.number}`}
        className="mt-6 overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]"
      >
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="relative min-h-72 overflow-hidden border-b border-[var(--surface-border)] p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-4 -top-12 font-display text-[11rem] font-bold leading-none text-ink opacity-[0.04]"
            >
              {active.number}
            </span>
            <div className="relative z-10 max-w-lg">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent.soft} ${accent.text}`}>
                <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
              </div>
              <h3 className="mt-6 font-display text-2xl font-semibold text-ink">{active.visualTitle}</h3>
              <div className="mt-6 space-y-3">
                {active.visualItems.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-ink-muted">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${accent.marker}`} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <p className={`text-sm font-medium ${accent.text}`}>{active.title}</p>
            <p className="mt-3 max-w-prose leading-relaxed text-ink-muted">{active.body}</p>
            <ul className="mt-7 space-y-3 border-t border-[var(--surface-border)] pt-6 text-sm text-ink-muted">
              {active.detail.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent.marker}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div
          className="relative h-1 bg-[var(--surface-border)]"
          role="progressbar"
          aria-label={`Showing process stage ${activeIndex + 1} of ${stages.length}`}
          aria-valuemin={1}
          aria-valuemax={stages.length}
          aria-valuenow={activeIndex + 1}
        >
          <span
            key={active.number}
            className={`block h-full origin-left ${accent.marker}`}
            style={{
              animation: "process-stage-progress 7s linear forwards",
              animationPlayState: isInteracting ? "paused" : "running",
            }}
          />
        </div>
      </section>

      <style jsx global>{`
        @keyframes process-stage-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
