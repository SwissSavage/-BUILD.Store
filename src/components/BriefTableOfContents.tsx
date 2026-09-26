"use client";

import { useEffect, useState } from "react";
import type { BriefHeading } from "@/components/Brief";

export function BriefTableOfContents({
  targetId,
  headings,
}: {
  targetId: string;
  headings: BriefHeading[];
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll("h2, h3, [data-brief-heading]"));
    nodes.forEach((node, index) => {
      const heading = headings[index];
      if (!heading) return;
      node.id = heading.id;
      node.classList.add("scroll-mt-6");
    });
    setReady(true);
  }, [headings, targetId]);

  if (!ready || headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        On this page
      </p>
      <ol className="mt-3 space-y-2 border-l border-[var(--surface-border)] text-sm">
        {headings.map((entry) => (
          <li key={entry.id} className={entry.level === 3 ? "pl-5" : "pl-3"}>
            <a
              href={`#${entry.id}`}
              className="text-ink-muted hover:text-brand-magentaText"
              onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById(entry.id);
                target?.closest("details")?.setAttribute("open", "");
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
                window.history.replaceState(null, "", `#${entry.id}`);
              }}
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
