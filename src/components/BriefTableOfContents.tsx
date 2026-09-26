"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { BriefHeading } from "@/components/Brief";

export function BriefTableOfContents({
  targetId,
  headings,
}: {
  targetId: string;
  headings: BriefHeading[];
}) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const groups: { heading: BriefHeading; children: BriefHeading[] }[] = [];

  for (const entry of headings) {
    if (entry.level === 2 || groups.length === 0) {
      groups.push({ heading: entry, children: [] });
    } else {
      groups[groups.length - 1].children.push(entry);
    }
  }

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

  useEffect(() => {
    const updateProgress = () => {
      const root = document.getElementById(targetId);
      if (!root) return;
      const start = root.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(root.offsetHeight - window.innerHeight, 1);
      setProgress(Math.min(100, Math.max(0, Math.round(((window.scrollY - start) / distance) * 100))));
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [targetId]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // A dismissed native share dialog is not an error the reader needs to see.
    }
  };

  // This grid cell always exists on desktop. Without it, a brief with no
  // headings would slide into the table-of-contents column.
  return (
    <div className={ready && headings.length > 0 ? "" : "hidden lg:block"}>
      {ready && headings.length > 0 && (
        // Desktop rail: keep navigation in view while the brief scrolls.
        <nav aria-label="Table of contents" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Table of contents
          </p>
          <ol className="mt-3 list-outside list-decimal space-y-3 pl-5 text-sm marker:text-ink-faint">
            {groups.map((group) => (
              <li key={group.heading.id}>
                <a
                  href={`#${group.heading.id}`}
                  className="block text-ink-muted hover:text-brand-magentaText"
                  onClick={(event) => {
                    event.preventDefault();
                    const target = document.getElementById(group.heading.id);
                    target?.closest("details")?.setAttribute("open", "");
                    target?.scrollIntoView({ behavior: "smooth", block: "start" });
                    window.history.replaceState(null, "", `#${group.heading.id}`);
                  }}
                >
                  {group.heading.label}
                </a>
                {group.children.length > 0 && (
                  <ol className="mt-2 list-outside list-[lower-alpha] space-y-2 pl-5 marker:text-ink-faint">
                    {group.children.map((entry) => (
                      <li key={entry.id}>
                        <a
                          href={`#${entry.id}`}
                          className="block text-ink-muted hover:text-brand-magentaText"
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
                )}
              </li>
            ))}
          </ol>
          <div className="mt-8 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Share this post
              </p>
              <button
                type="button"
                onClick={share}
                className="mt-2 text-sm text-ink-muted hover:text-brand-magentaText"
              >
                {copied ? "Link copied" : "Share link"}
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold tabular-nums text-ink">{progress}% read</p>
              <div className="mt-2 h-px bg-[var(--surface-border)]" aria-hidden="true">
                <div
                  className="h-px bg-brand-magenta transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted hover:text-brand-magentaText"
            >
              <ArrowUp aria-hidden="true" size={14} strokeWidth={1.75} />
              Back to top
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
