"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import {
  initialHomepageQuestionState,
  submitHomepageQuestion,
} from "@/app/(public)/homepage-question-actions";

const fieldClassName =
  "w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none";

/** Homepage-only question intake; successful submissions land in admin inbound. */
export function HomepageQuestionForm() {
  const [state, formAction] = useActionState(
    submitHomepageQuestion,
    initialHomepageQuestionState,
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
    >
      <h3 className="font-display text-xl font-semibold">Ask a question</h3>
      <p className="mt-2 text-sm text-ink-muted">
        Didn&apos;t find what you needed? Send it directly to the team.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-ink">
          Name
          <input
            name="name"
            autoComplete="name"
            required
            className={`mt-1.5 ${fieldClassName}`}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className={`mt-1.5 ${fieldClassName}`}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Phone number
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            className={`mt-1.5 ${fieldClassName}`}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Question
          <textarea
            name="question"
            required
            rows={7}
            className={`mt-1.5 min-h-40 resize-y ${fieldClassName}`}
          />
        </label>
      </div>

      {state.status !== "idle" && (
        <p
          className={`mt-4 text-sm ${
            state.status === "success" ? "text-brand-green" : "text-brand-magentaText"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}

      <SubmitButton className="mt-6" pendingLabel="Sending question…">
        Send question
      </SubmitButton>
    </form>
  );
}
