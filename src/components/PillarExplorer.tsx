"use client";

import { useState } from "react";

const pillars = [
  {
    id: "stem",
    title: "STEM",
    image: "/images/pillars/stem.webp",
    accent: "blue",
    blurb: "Full-stack, data, AI/ML, blockchain, cybersecurity, research.",
    strengths: ["Engineering systems", "AI, data, and research", "Security and technical delivery"],
  },
  {
    id: "creative-media",
    title: "Creative Media",
    image: "/images/pillars/artist.webp",
    accent: "magenta",
    blurb: "Music, film, editorial, design, direction, post-production.",
    strengths: ["Creative direction", "Editorial and visual storytelling", "Production from concept to release"],
  },
  {
    id: "professional-services",
    title: "Professional Services",
    image: "/images/pillars/professional-services.webp",
    accent: "green",
    blurb: "Strategy, legal, finance, operations, management consulting.",
    strengths: ["Strategy and operations", "Legal and financial expertise", "Cross-functional delivery"],
  },
] as const;

const accents = {
  blue: { border: "border-brand-blue", text: "text-brand-blueText", marker: "bg-brand-blue" },
  magenta: { border: "border-brand-magenta", text: "text-brand-magentaText", marker: "bg-brand-magenta" },
  green: { border: "border-brand-green", text: "text-brand-greenText", marker: "bg-brand-green" },
} as const;

export function PillarExplorer() {
  const [activeId, setActiveId] = useState<(typeof pillars)[number]["id"]>("stem");

  return (
    <div className="relative mt-10">
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 160"
        className="pointer-events-none absolute left-0 top-1/2 hidden h-40 w-full -translate-y-1/2 opacity-30 lg:block"
      >
        <path d="M0 118C200 18 420 18 620 118s390 100 580 0" fill="none" stroke="#5070F0" strokeWidth="2" />
        <path d="M0 140C225 40 450 40 670 140s350 100 530 0" fill="none" stroke="#E85CC8" strokeWidth="2" />
      </svg>
      <div className="relative z-10 flex flex-col gap-4 md:flex-row">
        {pillars.map((pillar) => {
          const isActive = activeId === pillar.id;
          const accent = accents[pillar.accent];

          return (
            <article
              key={pillar.id}
              onMouseEnter={() => setActiveId(pillar.id)}
              className={`group relative min-h-[26rem] overflow-hidden rounded-2xl border bg-[var(--surface-elevated)] transition-[flex-grow,filter] duration-500 ease-out motion-reduce:transition-none ${accent.border} ${isActive ? "md:flex-[1.65]" : "md:flex-1"}`}
            >
              <img
                src={pillar.image}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out motion-reduce:transition-none ${isActive ? "scale-105" : "scale-100"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/20" />
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveId(pillar.id)}
                className="relative flex h-full w-full flex-col justify-end p-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand-blue"
              >
                <span className={`text-sm font-medium ${accent.text}`}>{pillar.title}</span>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">{pillar.blurb}</p>
                <div
                  className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${isActive ? "mt-5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"}`}
                >
                  <ul className="overflow-hidden border-t border-white/20 pt-4 text-sm text-white/85">
                    {pillar.strengths.map((strength) => (
                      <li key={strength} className="flex gap-3 py-1.5">
                        <span aria-hidden="true" className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent.marker}`} />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
