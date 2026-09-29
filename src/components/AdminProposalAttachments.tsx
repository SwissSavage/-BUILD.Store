"use client";

import { useRef, useState } from "react";
import { FileText, X } from "lucide-react";

type ExistingAttachment = {
  name: string;
  sizeBytes: number;
};

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.md";

export function AdminProposalAttachments({
  proposalId,
  attachments,
  maxAttachments = 3,
}: {
  proposalId: string;
  attachments: ExistingAttachment[];
  maxAttachments?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kept, setKept] = useState(() =>
    attachments.map((document, index) => ({ document, index })),
  );
  const [selected, setSelected] = useState<File[]>([]);
  const [message, setMessage] = useState("");

  const syncSelectedFiles = (files: File[]) => {
    const input = inputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  };

  const removeSelected = (index: number) => {
    const next = selected.filter((_, fileIndex) => fileIndex !== index);
    setSelected(next);
    syncSelectedFiles(next);
  };

  const total = kept.length + selected.length;

  return (
    <section className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4">
      <input type="hidden" name="attachmentEditor" value="staged" readOnly />
      <p className="text-xs uppercase tracking-wider text-ink-muted">
        Portfolio documents
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Add or remove files here, then save the admin edit to persist the changes.
      </p>

      {total > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {kept.map(({ document, index }) => (
            <li
              key={`${document.name}-${index}`}
              className="relative flex h-[4.5rem] w-full max-w-64 flex-none min-w-0 items-center gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] py-2 pl-3 pr-11"
            >
              <input type="hidden" name="keepAttachment" value={index} />
              <FileText aria-hidden="true" size={18} className="shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/proposals/${proposalId}/attachments/${index}`}
                  className="block truncate text-sm text-brand-magentaText hover:underline"
                  title={document.name}
                >
                  {document.name}
                </a>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  {(document.sizeBytes / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => setKept((current) => current.filter((item) => item.index !== index))}
                aria-label={`Remove ${document.name}`}
                title={`Remove ${document.name}`}
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-[var(--surface-border)] hover:text-brand-magentaText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
              >
                <X aria-hidden="true" size={15} />
              </button>
            </li>
          ))}
          {selected.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="relative flex h-[4.5rem] w-full max-w-64 flex-none min-w-0 items-center gap-3 rounded-lg border border-dashed border-brand-magenta/60 bg-[var(--surface)] py-2 pl-3 pr-11"
            >
              <FileText aria-hidden="true" size={18} className="shrink-0 text-brand-magentaText" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink" title={file.name}>
                  {file.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  {(file.size / 1024).toFixed(0)} KB · pending
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeSelected(index)}
                aria-label={`Remove ${file.name}`}
                title={`Remove ${file.name}`}
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-[var(--surface-border)] hover:text-brand-magentaText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
              >
                <X aria-hidden="true" size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">No documents attached.</p>
      )}

      {total < maxAttachments && (
        <label className="mt-3 block text-xs text-ink-muted">
          Choose files
          <input
            ref={inputRef}
            name="attachments"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(event) => {
              const available = maxAttachments - total;
              const incoming = Array.from(event.target.files ?? []);
              const next = [...selected, ...incoming.slice(0, available)];
              setSelected(next);
              syncSelectedFiles(next);
              setMessage(incoming.length > available ? `Up to ${maxAttachments} documents can be attached.` : "");
            }}
            className="mt-1 block max-w-full text-xs text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-[var(--surface-elevated)] file:px-3 file:py-1.5 file:text-xs file:text-ink hover:file:bg-[var(--surface-border)]"
          />
        </label>
      )}
      {message && <p className="mt-2 text-xs text-brand-magentaText">{message}</p>}
      <p className="mt-2 text-xs text-ink-faint">Optional · up to {maxAttachments} files, 2 MB each.</p>
    </section>
  );
}
