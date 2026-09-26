"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; label: string; level: 2 | 3 };

function slug(value: string, index: number) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `brief-${base}` : `brief-section-${index + 1}`;
}

export function BriefTableOfContents({ targetId }: { targetId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const seen = new Map<string, number>();
    const headings = Array.from(root.querySelectorAll("h2, h3, [data-brief-heading]"));
    const next = headings.flatMap((node, index) => {
      const label = node.textContent?.trim() ?? "";
      if (!label) return [];
      const count = seen.get(label) ?? 0;
      seen.set(label, count + 1);
      const id = node.id || `${slug(label, index)}${count ? `-${count + 1}` : ""}`;
      node.id = id;
      return [{ id, label, level: node.tagName === "H3" ? 3 : 2 } as Entry];
    });
    setEntries(next);
  }, [targetId]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        On this page
      </p>
      <ol className="mt-3 space-y-2 border-l border-[var(--surface-border)] text-sm">
        {entries.map((entry) => (
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
