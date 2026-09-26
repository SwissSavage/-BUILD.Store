"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Check, Link2, ListTree, Mail, Share2 } from "lucide-react";
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
  const [shareUrl, setShareUrl] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const groups: { heading: BriefHeading; children: BriefHeading[] }[] = [];

  for (const entry of headings) {
    if (entry.level === 2 || groups.length === 0) {
      groups.push({ heading: entry, children: [] });
    } else {
      groups[groups.length - 1].children.push(entry);
    }
  }

  useEffect(() => {
    setShareUrl(window.location.href);
    setShareTitle(document.title);
  }, []);

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be unavailable in older or non-secure browser contexts.
      window.prompt("Copy this link:", window.location.href);
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
            <span className="flex items-center gap-1.5">
              <ListTree aria-hidden="true" size={14} strokeWidth={1.75} />
              Table of contents
            </span>
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
                <span className="flex items-center gap-1.5">
                  <Share2 aria-hidden="true" size={14} strokeWidth={1.75} />
                  Share this post
                </span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`}
                  aria-label="Share by email"
                  title="Share by email"
                  className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-[var(--surface-inset)] hover:text-brand-magentaText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                >
                  <Mail aria-hidden="true" size={16} strokeWidth={1.75} />
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Share on LinkedIn"
                  title="Share on LinkedIn"
                  className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-[var(--surface-inset)] hover:text-brand-magentaText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                >
                  <LinkedInIcon />
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Share on Facebook"
                  title="Share on Facebook"
                  className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-[var(--surface-inset)] hover:text-brand-magentaText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                >
                  <FacebookIcon />
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label={copied ? "Link copied" : "Copy link"}
                  title={copied ? "Link copied" : "Copy link"}
                  className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-[var(--surface-inset)] hover:text-brand-magentaText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
                >
                  {copied ? <Check aria-hidden="true" size={16} strokeWidth={1.75} /> : <Link2 aria-hidden="true" size={16} strokeWidth={1.75} />}
                </button>
                <span className="sr-only" aria-live="polite">
                  {copied ? "Link copied to clipboard" : ""}
                </span>
              </div>
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

// Brand SVG paths from Bootstrap Icons (MIT): https://icons.getbootstrap.com/
function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
      <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951" />
    </svg>
  );
}
