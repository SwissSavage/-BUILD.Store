/**
 * Rate how somebody RAN the engagement.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A CLIENT COMPONENT (2026-11-23)
 *
 * submitAdminReview refuses for several reasons a person needs to
 * read: the engagement is not complete yet, they were not on it, that
 * person did not run it, they have already reviewed them. In
 * production Next renders every one of those as "An error occurred in
 * the Server Components render."
 *
 * WHY EVERY AXIS IS SKIPPABLE
 *
 * A forced answer is noise dressed as data. Somebody who never had a
 * scoping conversation has nothing true to say about scope clarity,
 * and a middle star from them is indistinguishable from a considered
 * three. Null means "did not answer" and the aggregate skips it.
 *
 * WHY THE ANONYMITY PROMISE IS ON THE FORM
 *
 * Because it is load-bearing here in a way it is not on a peer
 * review. The person being rated decides what work the reviewer is
 * offered next. If the reviewer does not believe the anonymity, they
 * will rate politely and the instrument measures nothing. Saying it
 * plainly, at the point of answering, is the cheapest thing that
 * makes it credible.
 *
 * Presentational only: everything arrives as a prop, so this never
 * reaches the database and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  submitAdminReview,
  type AdminReviewResult,
} from "@/lib/admin-review-actions";
import { REVIEW_AXES } from "@/lib/engagement-roles";
import { HalfStarField } from "@/components/HalfStarField";

type FormState = AdminReviewResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return submitAdminReview(formData);
}

/*
 * Wording lives in lib/engagement-roles.ts rather than here, because
 * the role picker shows the same labels while an admin is choosing
 * what somebody did, and two copies of a question drift.
 */

export function AdminReviewForm({
  projectId,
  subjectUserId,
  subjectName,
  axes,
}: {
  projectId: string;
  subjectUserId: string;
  subjectName: string;
  /**
   * Which axes this person's roles make them answerable for, from
   * axesFor(). Never the full list by default: scope is declared at
   * role assignment, not inferred here. An empty array means the
   * caller should be showing the role picker instead of this form.
   */
  axes: string[];
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <p className="text-sm" style={{ color: "#007048" }}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="subjectUserId" value={subjectUserId} />

      {/*
        One shared field per axis. The scale, the skip affordance and
        the required reason are HalfStarField's business, not this
        form's — three forms owning three copies of a rating scale is
        how they drift apart.
      */}
      {REVIEW_AXES.filter((a) => axes.includes(a.axis)).map((axis) => (
        <HalfStarField
          key={axis.axis}
          name={axis.axis}
          label={axis.label}
          question={axis.question}
          example={axis.example}
        />
      ))}

      <div>
        <label
          htmlFor={`prose-${subjectUserId}`}
          className="block text-[11px] uppercase tracking-wider text-ink-muted"
        >
          Anything worth saying? (optional)
        </label>
        <textarea
          id={`prose-${subjectUserId}`}
          name="prose"
          rows={3}
          placeholder="What made the engagement easier or harder to work on."
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#5070F0" }}
        >
          {isPending ? "Sending…" : `Review ${subjectName}`}
        </Button>
        {/*
          Said plainly because it is true and because it is what makes
          answering worth the two minutes: this moves their standing,
          and it is the same OVR everyone else is held to.
        */}
        <span className="text-[11px] text-ink-faint">
          Feeds {subjectName}&rsquo;s OVR. They see the score move, never
          who said what.
        </span>
      </div>

      {state && !state.ok && (
        <p className="text-xs" style={{ color: "#d84343" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
