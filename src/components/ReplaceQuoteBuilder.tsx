/**
 * The Replace control on a Builder's card in the quote composer (#281).
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT IS FOLDED AWAY UNTIL ASKED FOR (2026-11-20)
 *
 * Swapping somebody off a client quote should take a decision, not a
 * stray click. The control is a disclosure: the card shows one quiet
 * link, and the form only exists once an admin has said they mean it.
 *
 * Same shape as the dispute form on a remittance statement, for the
 * same reason — an action that is easy to reach but not easy to fire
 * by accident.
 *
 * WHY A CLIENT COMPONENT
 *
 * replaceQuoteBuilder refuses for several reasons an admin needs to
 * read: the quote has already gone out, the replacement is already on
 * it, the reason is too thin. In production Next renders every one of
 * those as "An error occurred in the Server Components render."
 *
 * WHY THE REASON FIELD SAYS WHERE IT GOES
 *
 * It lands in the audit log, not in the client's document and not in
 * the message to the person coming off. Admins write differently when
 * they know who reads it, and the honest internal note is the one
 * worth keeping.
 *
 * Presentational only: candidates arrive as a prop, so this never
 * reaches the database and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import {
  replaceQuoteBuilder,
  type ReplaceBuilderResult,
} from "@/lib/quote-replace-builder-actions";

type FormState = ReplaceBuilderResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return replaceQuoteBuilder(formData);
}

const field =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm";
const label = "block text-[11px] uppercase tracking-wider text-ink-muted";

export function ReplaceQuoteBuilder({
  quoteId,
  outgoingUserId,
  outgoingName,
  candidates,
}: {
  quoteId: string;
  outgoingUserId: string;
  outgoingName: string;
  /** Members who could take the slot. Excludes anyone already on the quote. */
  candidates: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <p className="mt-3 text-sm" style={{ color: "#007048" }}>
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-ink-faint underline-offset-2 hover:text-brand-magentaText hover:underline"
      >
        Replace {outgoingName}
      </button>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="mt-3 text-xs text-ink-muted">
        Nobody else is available to take this slot. Add a Builder to the
        RFP first, then come back.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="outgoingUserId" value={outgoingUserId} />

      <div>
        <label htmlFor={`in-${outgoingUserId}`} className={label}>
          Who takes the slot
        </label>
        <select
          id={`in-${outgoingUserId}`}
          name="incomingUserId"
          required
          defaultValue=""
          className={field}
        >
          <option value="" disabled>
            Pick a Builder
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`tl-${outgoingUserId}`} className={label}>
          Their timeline
        </label>
        <input
          id={`tl-${outgoingUserId}`}
          name="timeline"
          type="text"
          required
          placeholder="6 weeks, part-time across the engagement"
          className={field}
        />
      </div>

      <div>
        <label htmlFor={`rl-${outgoingUserId}`} className={label}>
          Why this person
        </label>
        {/*
          Not carried over from the person coming off. Putting one
          Builder's justification under another's name on a client
          document is worse than leaving it blank.
        */}
        <input
          id={`rl-${outgoingUserId}`}
          name="relevance"
          type="text"
          required
          placeholder="The client reads this line under their name."
          className={field}
        />
      </div>

      <div>
        <label htmlFor={`rs-${outgoingUserId}`} className={label}>
          Why the swap
        </label>
        <input
          id={`rs-${outgoingUserId}`}
          name="reason"
          type="text"
          required
          placeholder="Goes in the audit log. Not sent to the client or to them."
          className={field}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#D828A0" }}
        >
          {isPending ? "Swapping…" : "Replace"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-faint underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-ink-faint">
        {outgoingName} keeps their application on this project and will
        be told they came off. Pricing stays on the slot; change it in
        the per-Builder editor if the number should move.
      </p>

      {state && !state.ok && (
        <p className="text-xs" style={{ color: "#d84343" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
