"use client";

import { useEffect, useState } from "react";

const minimumProposalCount = 3;
const maximumProposalCount = 5;

const requirements = [
  {
    message: "Select three to five proposals for the client comparison.",
    valid: (form: HTMLFormElement) => {
      const count = form.querySelectorAll('input[name="applicationIds"]:checked').length;
      return count >= minimumProposalCount && count <= maximumProposalCount;
    },
    target: 'input[name="applicationIds"]',
  },
  { message: "Enter the client display name.", valid: (form: HTMLFormElement) => ((form.elements.namedItem("clientDisplayName") as HTMLInputElement | null)?.value.trim().length ?? 0) >= 2, target: '[name="clientDisplayName"]' },
  { message: "Write a scope summary of at least 20 characters.", valid: (form: HTMLFormElement) => ((form.querySelector('[data-quote-field="scopeSummary"]') as HTMLTextAreaElement | null)?.value.trim().length ?? 0) >= 20, target: '[data-quote-focus="scopeSummary"] [contenteditable="true"]' },
  { message: "Add at least one deliverable.", valid: (form: HTMLFormElement) => ((form.elements.namedItem("deliverables") as HTMLTextAreaElement | null)?.value.trim().length ?? 0) > 0, target: '[name="deliverables"]' },
  { message: "Enter an engagement timeline (at least 4 characters).", valid: (form: HTMLFormElement) => ((form.elements.namedItem("timeline") as HTMLInputElement | null)?.value.trim().length ?? 0) >= 4, target: '[name="timeline"]' },
] as const;

/** Stops incomplete quote compilation before the server action is called. */
export function QuoteCompileRequirements() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const form = document.getElementById("compile-bids-form");
    if (!(form instanceof HTMLFormElement)) return;
    const validate = () => requirements.filter((requirement) => !requirement.valid(form));
    const setFieldStates = (invalid: readonly (typeof requirements)[number][]) => {
      for (const requirement of requirements) {
        const target = form.querySelector<HTMLElement>(requirement.target);
        if (target) target.dataset.invalid = String(invalid.includes(requirement));
      }
    };
    const sync = () => {
      const invalid = validate();
      const choices = form.querySelectorAll<HTMLInputElement>('input[name="applicationIds"]');
      const selectedCount = [...choices].filter((choice) => choice.checked).length;
      choices.forEach((choice) => {
        choice.disabled = !choice.checked && selectedCount >= maximumProposalCount;
      });
      setFieldStates(invalid);
      setErrors((current) => current.length ? invalid.map((item) => item.message) : current);
    };
    const onSubmit = (event: SubmitEvent) => {
      const invalid = validate();
      setFieldStates(invalid);
      if (invalid.length === 0) return;
      event.preventDefault();
      setErrors(invalid.map((item) => item.message));
      const first = form.querySelector<HTMLElement>(invalid[0].target);
      first?.closest("details")?.setAttribute("open", "");
      first?.scrollIntoView({ block: "center" });
      first?.focus();
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
  }, []);

  return errors.length > 0 ? (
    <section role="alert" className="rounded-xl border border-red-500/70 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      <p className="font-semibold">Finish the required fields before saving.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error) => <li key={error}>{error}</li>)}
      </ul>
    </section>
  ) : null;
}
