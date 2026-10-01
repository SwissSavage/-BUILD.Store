"use client";

import { useEffect, useState } from "react";

/** Keeps the quote compiler from submitting until an admin selects a bid. */
export function BidSelectionRequirement() {
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const form = document.getElementById("compile-bids-form");
    if (!(form instanceof HTMLFormElement)) return;

    const hasSelection = () =>
      Boolean(form.querySelector('input[name="applicationIds"]:checked'));
    const sync = () => {
      if (hasSelection()) setShowError(false);
    };
    const validate = (event: SubmitEvent) => {
      if (hasSelection()) return;
      event.preventDefault();
      setShowError(true);
      form.querySelector<HTMLInputElement>('input[name="applicationIds"]')?.focus();
    };

    form.addEventListener("change", sync);
    form.addEventListener("submit", validate);
    return () => {
      form.removeEventListener("change", sync);
      form.removeEventListener("submit", validate);
    };
  }, []);

  return showError ? (
    <p
      id="bid-selection-requirement"
      role="alert"
      className="mt-3 text-sm font-medium text-brand-magentaText"
    >
      Select at least one proposal before compiling the client quote.
    </p>
  ) : null;
}
