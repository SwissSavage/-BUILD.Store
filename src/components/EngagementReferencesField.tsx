"use client";

/**
 * Reference material, added a row at a time.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-08)
 *
 * Jamar: "If links/ attachments could be included that would also be
 * ideal. They're almost always necessary, but I don't like having them
 * sitting raw in the UX." Then: "There should also be a way to add
 * additional/ multiple links or attachments."
 *
 * Two lists, both repeatable. A link row is a label and a URL, and the
 * label is what renders everywhere afterwards: the point of the label
 * is that the URL is never the thing anyone reads.
 *
 * Rows post as parallel `referenceLabel` / `referenceUrl` arrays and
 * files as repeated `referenceFile` inputs, which is how repeatable
 * fields arrive from a plain form. No hidden JSON blob, so a row that
 * fails validation server-side still comes back with its text in it.
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import {
  MAX_ENGAGEMENT_FILES,
  MAX_ENGAGEMENT_LINKS,
  formatFileSize,
} from "@/lib/engagement-reference-limits";

interface LinkRow {
  key: string;
  label: string;
  url: string;
}

const field =
  "w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60";
const labelClass = "text-[11px] uppercase tracking-wider text-ink-muted";

function newRow(): LinkRow {
  return { key: Math.random().toString(36).slice(2), label: "", url: "" };
}

export function EngagementReferencesField({ disabled }: { disabled?: boolean }) {
  const [rows, setRows] = useState<LinkRow[]>([newRow()]);
  const [files, setFiles] = useState<File[]>([]);

  function update(key: string, patch: Partial<LinkRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Files accumulate across picks rather than replacing the selection,
  // because the documents for one engagement rarely live in one folder.
  // A native multiple-file input alone loses the first batch when you
  // open the picker again for the second.
  function addFiles(picked: FileList | null) {
    if (!picked) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const next = [...prev];
      for (const f of Array.from(picked)) {
        if (!seen.has(`${f.name}:${f.size}`)) next.push(f);
      }
      return next.slice(0, MAX_ENGAGEMENT_FILES);
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <p className={labelClass}>Reference material</p>
      <p className="mt-1 text-[11px] text-ink-faint">
        What the work runs on. Named, so the Builder reads the name and not
        the URL.
      </p>

      {/* ── links ────────────────────────────────────────────── */}
      <div className="mt-4 space-y-2">
        {rows.map((row, i) => (
          <div key={row.key} className="flex gap-2">
            <input
              name="referenceLabel"
              value={row.label}
              onChange={(e) => update(row.key, { label: e.target.value })}
              placeholder={i === 0 ? "Current version of the doc" : "What it is"}
              className={`${field} md:w-2/5`}
              disabled={disabled}
            />
            <input
              name="referenceUrl"
              value={row.url}
              onChange={(e) => update(row.key, { url: e.target.value })}
              placeholder="https://"
              inputMode="url"
              className={field}
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() =>
                setRows((prev) =>
                  prev.length === 1
                    ? [newRow()]
                    : prev.filter((r) => r.key !== row.key),
                )
              }
              disabled={disabled}
              aria-label="Remove this link"
              className="shrink-0 rounded-lg border border-[var(--surface-border)] px-3 text-sm text-ink-muted hover:text-ink disabled:opacity-60"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {rows.length < MAX_ENGAGEMENT_LINKS && (
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          disabled={disabled}
          className="mt-2 text-[11px] text-brand-magentaText hover:underline disabled:opacity-60"
        >
          Add another link
        </button>
      )}

      {/* ── files ────────────────────────────────────────────── */}
      <div className="mt-5 border-t border-[var(--surface-border)] pt-4">
        <span className={labelClass}>Attachments</span>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f) => (
              <li
                key={`${f.name}:${f.size}`}
                className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-1.5 text-xs"
              >
                <span className="truncate">{f.name}</span>
                <span className="ml-3 shrink-0 text-ink-faint">
                  {formatFileSize(f.size)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {/* One input per accumulated file, so the form posts all of
            them. A single multiple input only ever carries the last
            pick. */}
        {files.map((f) => (
          <input
            key={`input:${f.name}:${f.size}`}
            type="file"
            name="referenceFile"
            className="hidden"
            ref={(el) => {
              if (!el) return;
              const dt = new DataTransfer();
              dt.items.add(f);
              el.files = dt.files;
            }}
          />
        ))}
        <div className="mt-2 flex items-center gap-3">
          <label className="cursor-pointer text-[11px] text-brand-magentaText hover:underline">
            {files.length ? "Add another file" : "Attach a file"}
            <input
              type="file"
              multiple
              className="hidden"
              disabled={disabled || files.length >= MAX_ENGAGEMENT_FILES}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {files.length > 0 && (
            <button
              type="button"
              onClick={() => setFiles([])}
              disabled={disabled}
              className="text-[11px] text-ink-faint hover:text-ink disabled:opacity-60"
            >
              Clear
            </button>
          )}
          <span className="text-[10px] text-ink-faint">
            Up to {MAX_ENGAGEMENT_FILES}, 4 MB each. Link anything larger.
          </span>
        </div>
      </div>
    </section>
  );
}
