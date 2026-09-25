import type { JSONContent } from "@tiptap/core";

export type RichTextDocument = JSONContent & { type: "doc" };

const PREFIX = "tiptap:";

export function parseRichText(value: string): RichTextDocument | null {
  if (!value.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(PREFIX.length)) as RichTextDocument;
    return parsed?.type === "doc" ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeRichText(value: RichTextDocument): string {
  return `${PREFIX}${JSON.stringify(value)}`;
}

/** Turn an existing plain-text brief into a safe first editor document. */
export function richTextInitialValue(value: string): RichTextDocument {
  return (
    parseRichText(value) ?? {
      type: "doc",
      content: value
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
    }
  );
}

/** Plain-text fallback for validation and compact card summaries. */
export function richTextPlainText(value: RichTextDocument): string {
  const chunks: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as { text?: unknown; content?: unknown[] };
    if (typeof record.text === "string") chunks.push(record.text);
    if (Array.isArray(record.content)) record.content.forEach(visit);
  };
  visit(value);
  return chunks.join(" ");
}
