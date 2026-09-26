"use client";

import { type MouseEvent, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  richTextInitialValue,
  serializeRichText,
  type RichTextDocument,
} from "@/lib/rich-text";

const buttonClass =
  "rounded-md border border-[var(--surface-border)] px-2 py-1 text-xs text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText disabled:opacity-40";
const preserveSelection = (event: MouseEvent<HTMLButtonElement>) =>
  event.preventDefault();
const titleWord = (word: string) =>
  /^[A-Z0-9][A-Za-z0-9'’/+-]*$/.test(word) || /^[&/+-]$/.test(word);

function pastedHeading(line: string): { level: 2 | 3; text: string; body?: string } | null {
  const markdown = line.match(/^(#{2,3})\s+(.+)$/);
  if (markdown) return { level: markdown[1].length as 2 | 3, text: markdown[2] };

  const marker = line.match(/^((?:\d{1,2}|[A-Z])\.)\s+(.+)$/);
  if (marker) {
    const words = marker[2].split(/\s+/);
    let cut = 0;
    for (let i = 0; i < Math.min(words.length, 8); i += 1) {
      if (!titleWord(words[i])) break;
      if (/^[a-z]/.test(words[i + 1] ?? "")) break;
      cut = i + 1;
    }
    const text = words.slice(0, cut).join(" ");
    const body = words.slice(cut).join(" ");
    if (text && (body.length >= 20 || body.length === 0)) {
      return { level: /^\d/.test(marker[1]) ? 2 : 3, text: `${marker[1]} ${text}`, body };
    }
  }
  return null;
}

/** Turn clear section labels in plain-text pastes into real document headings. */
function structuredPaste(text: string): JSONContent[] | null {
  const lines = text
    .replace(/([^\n])\s+(?=(?:\d{1,2}|[A-Z])\.\s+[A-Z])/g, "$1\n")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const content: JSONContent[] = [];
  let recognised = false;
  let listItems: JSONContent[] = [];
  const flushList = () => {
    if (listItems.length > 0) {
      content.push({ type: "bulletList", content: listItems });
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      listItems.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: bullet[1] }] }],
      });
      continue;
    }
    flushList();
    const heading = pastedHeading(line);
    if (heading) {
      recognised = true;
      content.push({ type: "heading", attrs: { level: heading.level }, content: [{ type: "text", text: heading.text }] });
      if (heading.body) content.push({ type: "paragraph", content: [{ type: "text", text: heading.body }] });
      continue;
    }
    content.push({ type: "paragraph", content: [{ type: "text", text: line }] });
  }
  flushList();
  return recognised ? content : null;
}

export function RichTextEditor({
  name,
  initialValue,
}: {
  name: string;
  initialValue: string;
}) {
  const initial = richTextInitialValue(initialValue);
  const [value, setValue] = useState(() => serializeRichText(initial));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
      }),
    ],
    content: initial,
    editorProps: {
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html") ?? "";

        // Preserve actual rich text from Word/browsers. Markdown copied from a
        // code block is exposed as HTML too, but its plain-text payload is what
        // we need to turn into headings and bullet lists.
        if (html && !/<(?:pre|code)\b/i.test(html)) return false;
        const content = structuredPaste(event.clipboardData?.getData("text/plain") ?? "");
        if (!content) return false;
        event.preventDefault();
        editor?.chain().focus().insertContent(content).run();
        return true;
      },
      attributes: {
        class:
          "min-h-64 px-4 py-3 text-sm leading-relaxed text-ink outline-none [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-display [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wider [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-magenta [&_blockquote]:pl-4 [&_a]:text-brand-magentaText [&_a]:underline",
      },
    },
    onUpdate: ({ editor: nextEditor }) =>
      setValue(serializeRichText(nextEditor.getJSON() as RichTextDocument)),
  });

  const addLink = () => {
    const href = window.prompt("Link URL");
    if (!href) return;
    editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const toggleBold = () => {
    if (!editor) return;
    const { empty, to } = editor.state.selection;
    const chain = editor.chain().focus().toggleBold();

    // Applying bold to a selection should not make the next typed text bold.
    if (!empty) chain.setTextSelection(to).unsetAllMarks();
    chain.run();
  };

  return (
    <div className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)]">
      <input type="hidden" name={name} value={value} />
      <EditorContent editor={editor} />
      <div className="sticky bottom-4 z-20 flex flex-wrap gap-1 border-t border-[var(--surface-border)] bg-[var(--surface-elevated)] p-2">
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={toggleBold} disabled={!editor} aria-label="Bold"><strong>B</strong></button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={!editor} aria-label="Italic"><em>I</em></button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={!editor} aria-label="Underline"><u>U</u></button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={!editor} aria-label="Strikethrough"><s>S</s></button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} disabled={!editor}>H2</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} disabled={!editor}>H3</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={!editor}>• List</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={!editor}>1. List</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={!editor}>Quote</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={addLink} disabled={!editor}>Link</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>Undo</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>Redo</button>
      </div>
    </div>
  );
}
