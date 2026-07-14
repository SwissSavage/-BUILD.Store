"use client";

/**
 * Client-side "Change decision" button rendered inside the approved
 * or declined sections on /quotes/[token]. Calls
 * undoCooperativeQuoteDecision, then router.refresh() so the parent
 * server component re-renders back into the pre-decision surface with
 * the reveal + selection UI.
 *
 * Split into its own client component so the parent page can stay
 * server-rendered. Keeps the client boundary small (one button + one
 * confirm gesture) without hoisting the whole decided-state UI into a
 * client component.
 *
 * Undo isn't destructive. It reverts status to "viewed", clears the
 * selectedLeadUserId + decidedAt, and preserves the previous decision
 * in the audit log via the standard quote.approved / quote.declined
 * verb (with before/after payload showing the revert). Admins get a
 * "reopened" notification so they can pause any kickoff momentum.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoCooperativeQuoteDecision } from "@/lib/quote-actions";

interface QuoteDecidedUndoButtonProps {
  clientToken: string;
  /** Which state the client is undoing. Only affects button copy. */
  previousDecision: "approved" | "declined";
  /**
   * Optional callback fired once the undo succeeds server-side.
   * Used by the parent client shell (QuoteInteractiveSurface) to
   * reset any optimistic post-decision state so the reveal UI
   * comes back. Server-rendered decided sections don't need this
   * because they'll re-render from the fresh server tree.
   */
  onUndoSuccess?: () => void;
}

export function QuoteDecidedUndoButton({
  clientToken,
  previousDecision,
  onUndoSuccess,
}: QuoteDecidedUndoButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleUndo() {
    if (pending) return;
    setError(null);
    const formData = new FormData();
    formData.set("token", clientToken);
    startTransition(async () => {
      try {
        await undoCooperativeQuoteDecision(formData);
        onUndoSuccess?.();
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (!confirming) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="text-xs text-brand-magenta underline decoration-brand-magenta/40 underline-offset-4 transition-colors hover:decoration-brand-magenta disabled:opacity-60"
        >
          {previousDecision === "approved"
            ? "Change my mind"
            : "Actually, let me reconsider"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-sm text-ink">
        {previousDecision === "approved"
          ? "Reopen the quote and reselect your lead?"
          : "Reopen the quote and revisit the crew?"}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Your previous decision stays in the audit trail. Future Modern
        admin will be notified to pause any kickoff momentum.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={pending}
          className="inline-flex items-center rounded-full bg-brand-magenta px-4 py-1.5 text-xs font-medium text-brand-white shadow-sm shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90 disabled:opacity-60"
        >
          {pending ? "Reopening…" : "Yes, reopen"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="inline-flex items-center rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs text-ink transition-colors hover:border-ink hover:bg-[var(--surface-elevated)] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p
          className="mt-3 text-xs"
          style={{ color: "#E53E3E" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
