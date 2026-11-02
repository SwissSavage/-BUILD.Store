"use client";

import { Maximize2, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { DiagramZoom } from "@/components/DiagramZoom";

export function DiagramMobileViewer({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    setOpen(true);
    dialog.current?.showModal();
  }

  return (
    <div className="mt-5 sm:hidden">
      <button type="button" onClick={show} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--surface-border)] px-4 py-2 text-sm font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">
        <Maximize2 size={16} aria-hidden="true" /> View diagram
      </button>
      <dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby="mobile-diagram-title" className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-auto border-0 bg-[#06070a] p-0 text-ink backdrop:bg-black/80">
        <div className="flex min-h-[100dvh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--surface-border)] px-4 py-4">
            <h2 id="mobile-diagram-title" className="font-display text-xl font-semibold">Venture Labor diagram</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close diagram" className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--surface-border)] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"><X size={20} aria-hidden="true" /></button>
          </header>
          <div className="flex flex-1 items-center px-3 py-4">
            <div className="mx-auto w-full" style={{ maxWidth: "calc((100dvh - 210px) * 960 / 760)" }}>
              {open && <DiagramZoom>{children}</DiagramZoom>}
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
