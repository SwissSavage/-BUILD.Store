/**
 * Which slot this person's own rating counts in.
 *
 * Sits beside the role picker and is deliberately a separate control:
 * roles say what somebody is ASKED ABOUT, this says what their answer
 * COUNTS AS. Rob is asked about scope clarity because he ran the
 * engagement, and separately his rating of the design work counts as a
 * peer reading because he studied design.
 *
 * Only rendered where the peer slot cannot fill itself — the page
 * decides that, and the action re-checks it, because a server action
 * is a public endpoint and a hidden control is not a rule.
 *
 * Presentational only: everything arrives as a prop.
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  setReviewSlot,
  type SlotAssignResult,
} from "@/lib/review-slot-actions";
import {
  REVIEW_SLOT_DESCRIBES,
  REVIEW_SLOT_LABELS,
  type ReviewSlot,
} from "@/lib/review-slots";

type FormState = SlotAssignResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return setReviewSlot(formData);
}

const SLOTS: ReviewSlot[] = ["peer", "pm"];

export function ReviewSlotPicker({
  projectId,
  userId,
  personName,
  current,
  isContributor,
}: {
  projectId: string;
  userId: string;
  personName: string;
  current: ReviewSlot | null;
  /** Drives the "without this" line, which is the natural reading. */
  isContributor: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="userId" value={userId} />

      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        {personName}&rsquo;s own rating counts as
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {SLOTS.map((s) => (
          <label
            key={s}
            className="cursor-pointer rounded-lg border border-[var(--surface-border)] px-2.5 py-1 text-xs hover:border-brand-magenta has-[:checked]:border-brand-magenta has-[:checked]:text-brand-magentaText"
            title={REVIEW_SLOT_DESCRIBES[s]}
          >
            <input
              type="radio"
              name="slot"
              value={s}
              defaultChecked={current === s}
              className="sr-only"
            />
            {REVIEW_SLOT_LABELS[s]}
          </label>
        ))}
        {/*
          Clearing matters. An admin who put the wrong person in a slot
          needs a way back to the natural reading, not just a way to
          swap one override for another.
        */}
        <label className="cursor-pointer rounded-lg border border-dashed border-[var(--surface-border)] px-2.5 py-1 text-xs text-ink-faint hover:text-ink-muted">
          <input
            type="radio"
            name="slot"
            value=""
            defaultChecked={current === null}
            className="sr-only"
          />
          No override
        </label>
      </div>

      <p className="mt-1.5 text-[11px] text-ink-faint">
        {current
          ? REVIEW_SLOT_DESCRIBES[current]
          : isContributor
            ? "Without an override they count as a peer, because they did delivery work."
            : "Without an override their rating does not count toward the blend at all — an admin is not a peer unless somebody says so."}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magentaText disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save slot"}
        </Button>
        {state && (
          <span
            className="text-[11px]"
            style={{ color: state.ok ? "#007048" : "#d84343" }}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
