"use client";

/**
 * Stops an incomplete quote reaching the server, and stops a long form
 * being lost when something goes wrong anyway.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS WAS REWRITTEN (2026-10-06)
 *
 * Three failures, found by using it.
 *
 * 1. THE FORM WAS DESTROYED ON A FAILED SAVE. compileBidsIntoQuote
 *    throws when a picked bid is missing deliverables or strengths and
 *    weaknesses. Next redacts server action errors in production, the
 *    page re-renders from server state, and every word typed into the
 *    form is gone. An admin lost an afternoon of authored copy across
 *    three Builders this way.
 *
 *    The guard here was supposed to prevent that by calling
 *    preventDefault on submit, but React 19 dispatches a form `action`
 *    through its own path and a native submit listener does not
 *    reliably beat it. So the buttons are now DISABLED while anything
 *    is incomplete. A disabled button cannot be clicked, which does not
 *    depend on winning a race.
 *
 * 2. THE WRONG FIELDS TURNED RED. Each rule had one `target` selector
 *    like "[data-quote-deliverables]" with no value, and querySelector
 *    returns the first match on the page. So a missing field on the
 *    third Builder reddened the first Builder's filled-in box. The red
 *    was true about the form and a lie about the field.
 *
 *    Rules now return the exact elements at fault, and the message
 *    names whose card to look at.
 *
 * 3. NOTHING SURVIVED A RELOAD. Belt and braces for the above: every
 *    authored field is mirrored to localStorage as it is typed, keyed
 *    on the form's RFP, and restored if the page comes back empty.
 *    Cleared once a save succeeds. This is the backstop for the failure
 *    nobody predicted, not a replacement for the two fixes above.
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";

const minimumProposalCount = 3;
const maximumProposalCount = 5;

/**
 * A rule returns the elements that fail it, so only those get marked.
 * An empty array means the rule passes.
 */
interface Requirement {
  message: (form: HTMLFormElement) => string;
  offenders: (form: HTMLFormElement) => HTMLElement[];
}

function pickedIds(form: HTMLFormElement): string[] {
  return Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="applicationIds"]:checked'),
  ).map((input) => input.value);
}

function value(el: Element | null): string {
  return (el as HTMLInputElement | HTMLTextAreaElement | null)?.value?.trim() ?? "";
}

/** Who a field belongs to, for an error message that names a card. */
function ownerOf(el: HTMLElement | undefined): string {
  return el?.dataset.quoteOwner ?? "a picked Builder";
}

const requirements: Requirement[] = [
  {
    message: () => "Select three to five proposals for the client comparison.",
    offenders: (form) => {
      const count = pickedIds(form).length;
      if (count >= minimumProposalCount && count <= maximumProposalCount) return [];
      const first = form.querySelector<HTMLElement>('input[name="applicationIds"]');
      return first ? [first] : [];
    },
  },
  {
    message: () => "Enter the client display name.",
    offenders: (form) => {
      const el = form.querySelector<HTMLElement>('[name="clientDisplayName"]');
      return el && value(el).length >= 2 ? [] : el ? [el] : [];
    },
  },
  {
    message: () => "Write a scope summary of at least 20 characters.",
    offenders: (form) => {
      const field = form.querySelector('[data-quote-field="scopeSummary"]');
      if (value(field).length >= 20) return [];
      const focus = form.querySelector<HTMLElement>(
        '[data-quote-focus="scopeSummary"] [contenteditable="true"]',
      );
      return focus ? [focus] : [];
    },
  },
  {
    // Deliverables are per Builder. A card with a price and no
    // deliverables is the one thing a client cannot evaluate.
    message: (form) => {
      const missing = pickedIds(form)
        .map((id) =>
          form.querySelector<HTMLElement>(`[data-quote-deliverables="${id}"]`),
        )
        .filter((el): el is HTMLElement => !!el && value(el).length === 0);
      const names = [...new Set(missing.map((el) => ownerOf(el)))];
      return `Add at least one deliverable for ${names.join(" and ")}.`;
    },
    offenders: (form) =>
      pickedIds(form)
        .map((id) =>
          form.querySelector<HTMLElement>(`[data-quote-deliverables="${id}"]`),
        )
        .filter((el): el is HTMLElement => !!el && value(el).length === 0),
  },
  {
    // Both, not either. A card listing only what someone is good at is
    // marketing; the client is choosing between people and needs the
    // trade-off to decide.
    message: (form) => {
      const missing = pickedIds(form).flatMap((id) =>
        [
          form.querySelector<HTMLElement>(`[data-quote-strengths="${id}"]`),
          form.querySelector<HTMLElement>(`[data-quote-weaknesses="${id}"]`),
        ].filter((el): el is HTMLElement => !!el && value(el).length === 0),
      );
      const names = [...new Set(missing.map((el) => ownerOf(el)))];
      return `Write both strengths and weaknesses for ${names.join(" and ")}.`;
    },
    offenders: (form) =>
      pickedIds(form).flatMap((id) =>
        [
          form.querySelector<HTMLElement>(`[data-quote-strengths="${id}"]`),
          form.querySelector<HTMLElement>(`[data-quote-weaknesses="${id}"]`),
        ].filter((el): el is HTMLElement => !!el && value(el).length === 0),
      ),
  },
];

/** Every field whose text an admin authored and must not lose. */
const AUTHORED_SELECTOR = [
  "[data-quote-deliverables]",
  "[data-quote-strengths]",
  "[data-quote-weaknesses]",
  '[name="clientDisplayName"]',
  '[name="deliverables"]',
  '[name^="relevance_"]',
  '[name^="workSamples_"]',
  '[name^="clientRate_"]',
].join(",");

export function QuoteCompileRequirements({ draftKey }: { draftKey?: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const form = document.getElementById("compile-bids-form");
    if (!(form instanceof HTMLFormElement)) return;
    const storageKey = `fm-quote-draft:${draftKey ?? form.dataset.rfpId ?? "rfp"}`;

    const authored = () =>
      Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        AUTHORED_SELECTOR,
      )).filter((el) => el.name);

    // ── restore ────────────────────────────────────────────────
    // Only into fields the server left empty, so a saved draft coming
    // back from the database always wins over a stale local copy.
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        let touched = 0;
        for (const el of authored()) {
          const value = parsed[el.name];
          if (value && el.value.trim().length === 0) {
            el.value = value;
            touched += 1;
          }
        }
        if (touched > 0) setRestored(true);
      }
    } catch {
      // A corrupt or unavailable store must never stop the page working.
    }

    const persist = () => {
      try {
        const payload: Record<string, string> = {};
        for (const el of authored()) {
          if (el.value.trim().length > 0) payload[el.name] = el.value;
        }
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // Quota or private mode. Not worth breaking the form over.
      }
    };

    // ── validation ─────────────────────────────────────────────
    const sync = () => {
      const failing = requirements
        .map((requirement) => ({
          requirement,
          offenders: requirement.offenders(form),
        }))
        .filter((entry) => entry.offenders.length > 0);

      // Clear every field first, then mark only the real offenders.
      for (const el of form.querySelectorAll<HTMLElement>("[data-invalid]")) {
        delete el.dataset.invalid;
      }
      for (const entry of failing) {
        for (const el of entry.offenders) el.dataset.invalid = "true";
      }

      // Disabled rather than preventDefault: React 19 runs a form
      // action through its own dispatch and a native submit listener
      // does not reliably beat it. A disabled button cannot be clicked.
      const messages = failing.map((entry) => entry.requirement.message(form));
      for (const button of form.querySelectorAll<HTMLButtonElement>(
        "[data-quote-submit]",
      )) {
        button.disabled = messages.length > 0;
        button.title =
          messages.length > 0 ? messages.join(" ") : "";
      }

      const choices = form.querySelectorAll<HTMLInputElement>(
        'input[name="applicationIds"]',
      );
      const selectedCount = [...choices].filter((choice) => choice.checked).length;
      choices.forEach((choice) => {
        choice.disabled = !choice.checked && selectedCount >= maximumProposalCount;
      });

      setErrors(messages);
      persist();
    };

    // A successful save navigates away or re-renders with the draft
    // loaded from the database, so the local copy has done its job.
    const onSubmit = () => {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    };

    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    form.addEventListener("submit", onSubmit);
    sync();
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
      form.removeEventListener("submit", onSubmit);
    };
  }, [draftKey]);

  if (errors.length === 0 && !restored) return null;

  return (
    <div className="space-y-2">
      {restored && (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 text-xs text-ink-muted">
          Restored text you had typed here earlier but not saved. Check it
          before saving.
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-500/60 bg-red-500/5 px-4 py-3 text-xs text-ink">
          <p className="font-medium">
            Finish these before saving:
          </p>
          <ul className="mt-2 space-y-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
