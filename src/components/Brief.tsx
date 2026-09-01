/**
 * Structured rendering for an opportunity brief.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-01)
 *
 * Contract, job and initiative briefs are one `description` text
 * column, and every detail page rendered it as `<p>{description}</p>`.
 * A single paragraph. So an admin who wrote a brief with headings and
 * bullets got a run-on block — nothing they typed could produce
 * structure, and every opportunity looked identical to every other.
 *
 * Jamar's read on it: "each opportunity shows as full text, takes up
 * a bunch of space, and has no format. So it all starts looking the
 * same."
 *
 * Attachments were the obvious next thought and would have been the
 * wrong fix — a PDF hides the problem behind a download instead of
 * making the brief readable. Attachments are still worth having for
 * things that genuinely are documents; they just aren't the answer to
 * this.
 * ─────────────────────────────────────────────────────────────
 *
 * Deliberately not a markdown library. This needs to handle text
 * typed into a textarea by someone who is not thinking about syntax,
 * so it reads the shapes people already use — a short line ending in
 * a colon is a heading, a line starting with a dash or bullet is a
 * list item, a blank line separates paragraphs. Someone who writes
 * markdown out of habit gets a sensible result; someone who writes
 * plain prose is not punished for it.
 *
 * No dependency, no HTML parsing, nothing rendered as raw markup — so
 * an admin cannot inject markup into a public page through a brief.
 */

interface BriefBlock {
  kind: "heading" | "list" | "paragraph";
  text?: string;
  items?: string[];
}

/**
 * Inline emphasis, rendered as elements rather than markup.
 *
 * The author's own **bold** and *italic* are the formatting they meant,
 * and respecting it beats any structure this file could infer. Split
 * into React nodes — never `dangerouslySetInnerHTML` — so a brief can
 * carry emphasis without carrying markup onto a public page.
 */
function renderInline(text: string): React.ReactNode {
  const pattern = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|(\*|_)(?=\S)([\s\S]*?\S)\3/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const bold = m[2] !== undefined;
    const inner = bold ? m[2] : m[4];
    nodes.push(
      bold ? (
        <strong key={key++} className="font-semibold text-ink">
          {inner}
        </strong>
      ) : (
        <em key={key++}>{inner}</em>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length > 0 ? nodes : text;
}

/** Strip emphasis markers — for plain-text contexts like card summaries. */
function stripInline(text: string): string {
  return text.replace(/(\*\*|__|\*|_)(?=\S)([\s\S]*?\S)\1/g, "$2");
}

/**
 * A heading the author actually wrote: a markdown heading, a short
 * line ending in a colon, or a short line entirely wrapped in bold.
 *
 * That last one matters most — bolding the section name is what people
 * do when they aren't thinking about syntax, and it's the clearest
 * statement of intent in the whole file.
 */
function isHeading(line: string): boolean {
  if (/^#{1,4}\s+/.test(line)) return true;
  if (line.length <= 80 && /^(\*\*|__)[\s\S]+\1:?$/.test(line)) return true;
  return line.length <= 60 && /:$/.test(line) && !/^[-*•]/.test(line);
}

function isListItem(line: string): boolean {
  return /^\s*([-*•]|\d+[.)])\s+/.test(line);
}

function stripMarker(line: string): string {
  return line
    .replace(/^#{1,4}\s+/, "")
    // Bullets only — a "*bold*" line is emphasis, not a list item.
    .replace(/^\s*([-•]|\*(?!\*)(?=\s)|\d+[.)])\s+/, "")
    .replace(/:$/, "")
    .trim();
}

/**
 * Put line breaks back into a brief that lost them.
 *
 * Real RFPs arrive pasted out of a doc and land in the column as one
 * continuous string — "1. Objective The company seeks... 2. Background
 * & Current Environment The organization..." — with the section
 * markers inline. Splitting on newlines then finds exactly one
 * paragraph, which is how a structured eight-section RFP rendered as a
 * single grey wall.
 *
 * So before parsing, break at the markers people actually type:
 * numbered sections (1. 2. 3.), lettered subsections (A. B. C.), and
 * mid-string bullets (· • -). Only when the text is long and starved
 * of newlines — a brief that already has its own line breaks is left
 * exactly as the author wrote it.
 */
function restoreLineBreaks(raw: string): string {
  const newlines = (raw.match(/\n/g) ?? []).length;
  const dense = raw.length > 400 && newlines < raw.length / 400;
  if (!dense) return raw;

  return (
    raw
      // "… engine. 2. Background" → break before the number.
      .replace(/\s+(?=\d{1,2}\.\s+[A-Z])/g, "\n")
      // "… systems. A. Systems Audit" → break before the letter.
      .replace(/\s+(?=[A-Z]\.\s+[A-Z][a-z])/g, "\n")
      // Inline bullets — "·Co-develop topics ·Build flow".
      .replace(/\s*[·•]\s*/g, "\n- ")
      .replace(/\n{3,}/g, "\n\n")
  );
}

/**
 * A numbered or lettered section marker, with its Title Case heading.
 *
 * "1. Objective The company seeks…" has to split into the heading
 * "1. Objective" and the body "The company seeks…", and the only
 * reliable signal for where one ends is capitalisation: a heading is
 * Title Case throughout, and the sentence after it starts with one
 * capital and then drops to lowercase.
 *
 * So the heading ends at the last Title Case word BEFORE the first
 * Title Case word that is followed by a lowercase one — that word
 * starts the sentence.
 *
 *   "Objective The company…"       → The↓company    → "Objective"
 *   "Background & Current Environment The organization…"
 *                                  → The↓organization
 *                                  → "Background & Current Environment"
 *   "Required Expertise Candidates must…"
 *                                  → Candidates↓must → "Required Expertise"
 *   "Deliverables Systems audit report…"
 *                                  → Systems↓audit   → "Deliverables"
 *
 * A line that never drops to lowercase is a heading with no body,
 * which is what a properly line-broken document gives us.
 */
function splitMarkerHeading(
  line: string,
): { heading: string; body: string } | null {
  const m = line.match(/^((?:\d{1,2}|[A-Z])[.)])\s+(.*)$/);
  if (!m) return null;
  const [, marker, rest] = m;
  if (!rest) return null;

  const words = rest.split(/\s+/);
  const isTitleish = (w: string) =>
    /^[A-Z0-9][A-Za-z0-9'’/+-]*$/.test(w) || /^[&/+-]$/.test(w);
  const isLower = (w: string) => /^[a-z]/.test(w);

  let cut = words.length;
  for (let i = 0; i < Math.min(words.length, 8); i += 1) {
    if (!isTitleish(words[i])) {
      cut = i;
      break;
    }
    // This word is Title Case and the next is lowercase — it opens
    // the sentence, so the heading stopped before it.
    if (words[i + 1] !== undefined && isLower(words[i + 1])) {
      cut = i;
      break;
    }
    cut = i + 1;
  }

  if (cut === 0) return null; // Body starts immediately — not a heading.
  const heading = words.slice(0, cut).join(" ");
  const body = words.slice(cut).join(" ").trim();
  // "2. Review Bob's draft" splits cleanly and is still a list item, not
  // a section. A section carries prose after its heading; a numbered
  // to-do carries a few words. Anything short goes back to the list.
  if (body.length > 0 && body.length < 60) return null;
  return { heading: `${marker} ${heading}`, body };
}

/** Split raw brief text into blocks. */
export function parseBrief(raw: string): BriefBlock[] {
  const lines = restoreLineBreaks(raw).replace(/\r\n/g, "\n").split("\n");
  const blocks: BriefBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: [...list] });
      list = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      flushParagraph();
      continue;
    }
    if (isHeading(trimmed)) {
      flushList();
      flushParagraph();
      blocks.push({ kind: "heading", text: stripMarker(trimmed) });
      continue;
    }
    // Before the list check, because "1. " opens both a numbered list
    // item and a numbered section. splitMarkerHeading returns null for
    // anything that reads as a list item, so this only claims sections.
    const marked = splitMarkerHeading(trimmed);
    if (marked) {
      flushList();
      flushParagraph();
      blocks.push({ kind: "heading", text: marked.heading });
      if (marked.body) paragraph.push(marked.body);
      continue;
    }
    if (isListItem(trimmed)) {
      flushParagraph();
      list.push(stripMarker(trimmed));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushList();
  flushParagraph();

  return blocks;
}

/**
 * Group blocks under their headings so a long brief becomes sections
 * rather than one continuous scroll.
 */
function sectionize(blocks: BriefBlock[]): {
  heading: string | null;
  blocks: BriefBlock[];
}[] {
  const sections: { heading: string | null; blocks: BriefBlock[] }[] = [];
  let current: { heading: string | null; blocks: BriefBlock[] } = {
    heading: null,
    blocks: [],
  };
  for (const block of blocks) {
    if (block.kind === "heading") {
      if (current.blocks.length > 0 || current.heading) sections.push(current);
      current = { heading: block.text ?? null, blocks: [] };
      continue;
    }
    current.blocks.push(block);
  }
  if (current.blocks.length > 0 || current.heading) sections.push(current);
  return sections;
}

function BriefBody({ blocks }: { blocks: BriefBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h3
              key={i}
              className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink first:mt-0"
            >
              {renderInline(block.text ?? "")}
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="mt-3 space-y-1.5">
              {(block.items ?? []).map((item, j) => (
                <li
                  key={j}
                  className="flex gap-2.5 text-sm leading-relaxed text-ink-muted"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-magenta"
                  />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className="mt-3 text-sm leading-relaxed text-ink-muted first:mt-0"
          >
            {renderInline(block.text ?? "")}
          </p>
        );
      })}
    </>
  );
}

/** Loose equality — punctuation and case shouldn't decide this. */
function sameText(a: string, b: string): boolean {
  const norm = (v: string) =>
    stripInline(v)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

/** Drop a leading block that just repeats the title above it. */
function dropEchoedTitle(
  blocks: BriefBlock[],
  title?: string | null,
): BriefBlock[] {
  if (!title?.trim() || blocks.length === 0) return blocks;
  const first = blocks[0];
  if (!first.text || !sameText(first.text, title)) return blocks;
  return blocks.slice(1);
}

/**
 * Render a brief.
 *
 * A brief with headings becomes collapsible sections — the first open,
 * the rest closed — so the page shows a table of contents rather than
 * a wall. The full text of a real RFP is thousands of words; nobody
 * scrolls it, and printing all of it is why every opportunity looked
 * the same.
 *
 * Native `<details>`, so it works with no client JS and the browser's
 * find-in-page still reaches closed sections.
 *
 * A brief with no headings renders straight through — collapsing a
 * three-line description behind a toggle would be worse than showing
 * it.
 */
export function Brief({
  text,
  title,
  className,
}: {
  text: string | null | undefined;
  /**
   * The heading already on the page. A pasted brief usually opens by
   * repeating its own title, which then renders directly under the
   * <h1> saying the same thing.
   */
  title?: string | null;
  className?: string;
}) {
  if (!text?.trim()) return null;
  const blocks = dropEchoedTitle(parseBrief(text), title);
  const sections = sectionize(blocks);
  const hasHeadings = sections.some((sec) => sec.heading);

  if (!hasHeadings) {
    return (
      <div className={className}>
        <BriefBody blocks={blocks} />
      </div>
    );
  }

  return (
    <div className={className}>
      {sections.map((section, i) => {
        if (!section.heading) {
          // Lead-in prose above the first heading. Always visible —
          // it's the paragraph that says what the work actually is.
          return (
            <div key={i} className="mb-5">
              <BriefBody blocks={section.blocks} />
            </div>
          );
        }
        return (
          <details
            key={i}
            open={i <= 1}
            className="group border-t border-[var(--surface-border)] py-3"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-ink hover:text-brand-magenta">
              {renderInline(section.heading)}
              <span
                aria-hidden
                className="text-[10px] text-ink-faint transition-transform group-open:rotate-90"
              >
                ▸
              </span>
            </summary>
            <div className="pb-1 pt-2">
              <BriefBody blocks={section.blocks} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

/**
 * First meaningful sentence or two, for index cards.
 *
 * Skips a leading heading — "Scope:" is a useless preview — and stops
 * at a sensible length so every card in a list is the same height and
 * differs by its metadata rather than by how much prose someone
 * happened to write.
 */
export function briefSummary(
  text: string | null | undefined,
  options: { maxLength?: number; skipTitle?: string | null } = {},
): string {
  const { maxLength = 180, skipTitle } = options;
  if (!text?.trim()) return "";
  const firstProse = dropEchoedTitle(parseBrief(text), skipTitle).find(
    (b) => b.kind === "paragraph" && b.text,
  );
  const source = stripInline(firstProse?.text ?? text.trim());
  if (source.length <= maxLength) return source;
  const cut = source.slice(0, maxLength);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, lastStop > 80 ? lastStop : maxLength).trim()}…`;
}
