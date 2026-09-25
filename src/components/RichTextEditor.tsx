"use client";

import { type MouseEvent, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  richTextInitialValue,
  serializeRichText,
  type RichTextDocument,
} from "@/lib/rich-text";

const buttonClass =
  "rounded-md border border-[var(--surface-border)] px-2 py-1 text-xs text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText disabled:opacity-40";
const preserveSelection = (event: MouseEvent<HTMLButtonElement>) =>
  event.preventDefault();

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
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
      }),
    ],
    content: initial,
    editorProps: {
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
    <div className="mt-1 overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)]">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1 border-b border-[var(--surface-border)] bg-[var(--surface-elevated)] p-2">
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={toggleBold} disabled={!editor} aria-label="Bold"><strong>B</strong></button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={!editor} aria-label="Italic"><em>I</em></button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} disabled={!editor}>H2</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} disabled={!editor}>H3</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={!editor}>• List</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={!editor}>1. List</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={!editor}>Quote</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={addLink} disabled={!editor}>Link</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>Undo</button>
        <button type="button" className={buttonClass} onMouseDown={preserveSelection} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>Redo</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
