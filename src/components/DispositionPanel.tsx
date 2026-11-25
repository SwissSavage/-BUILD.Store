/**
 * Which way the engagement went when the margin came up short.
 *
 * A direction, not an action. The payouts already landed — the Builder
 * was paid their Base Rate plus whatever margin they earned, and FM
 * took 15% of that. Nothing on this form moves money; it records what
 * follows.
 *
 * Set once. The record of a shortfall is not something to revise
 * later, and the bench attached to a replacement already counts
 * against somebody.
 *
 * Presentational only: everything arrives as a prop.
 */
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import {
  setDisposition,
  type DispositionKind,
  type DispositionResult,
} from "@/lib/disposition-actions";

type FormState = DispositionResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return setDisposition(formData);
}

const DIRECTIONS: {
  kind: DispositionKind;
  label: string;
  describes: string;
}[] = [
  {
    kind: "stop",
    label: "Stop here",
    describes:
      "The shortfall is absorbed. Payouts stand as they landed and nothing further is distributed.",
  },
  {
    kind: "rebate",
    label: "Rebate the client",
    describes:
      "A concession is logged against this engagement. Nothing else is distributed, and the money moves through the usual payment rail.",
  },
  {
    kind: "replace",
    label: "Replace the talent",
    describes:
      "Somebody comes off and somebody else comes on. The person leaving is benched, and the replacement is engaged at a rate still to be agreed.",
  },
];

export function DispositionPanel({
  projectId,
  uncommittedLabel,
  people,
  existing,
}: {
  projectId: string;
  /** Formatted. Shown so the decision is made with the number visible. */
  uncommittedLabel: string;
  people: { id: string; name: string; isContributor: boolean }[];
  existing: {
    kind: DispositionKind;
    reason: string;
    at: string | null;
  } | null;
}) {
  const [kind, setKind] = useState<DispositionKind | null>(null);
  const [state, formAction, isPending] = useActionState(action, null);

  if (existing) {
    const label =
      DIRECTIONS.find((d) => d.kind === existing.kind)?.label ?? existing.kind;
    return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Direction
        </p>
        <p className="mt-1 font-medium">{label}</p>
        <p className="mt-1 text-sm text-ink-muted">{existing.reason}</p>
        <p className="mt-2 text-[11px] text-ink-faint">
          Set once, deliberately. This is the record of what happened.
        </p>
      </div>
    );
  }

  const contributors = people.filter((p) => p.isContributor);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <p className="text-sm text-ink-muted">
        {uncommittedLabel} is uncommitted on this engagement. Choosing a
        direction does not move it — the payouts already landed. This
        records what follows.
      </p>

      <div className="space-y-2">
        {DIRECTIONS.map((d) => (
          <label
            key={d.kind}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--surface-border)] p-3 hover:border-brand-magenta has-[:checked]:border-brand-magenta"
          >
            <input
              type="radio"
              name="kind"
              value={d.kind}
              checked={kind === d.kind}
              onChange={() => setKind(d.kind)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="font-medium">{d.label}</span>
              <span className="block text-[11px] text-ink-faint">
                {d.describes}
              </span>
            </span>
          </label>
        ))}
      </div>

      {kind === "replace" && (
        <div className="rounded-lg border border-[#B4740F]/40 bg-[var(--surface-inset)] p-3">
          <label className="block text-[11px] uppercase tracking-wider text-ink-muted">
            Who comes off
          </label>
          <select
            name="benchUserId"
            required
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              Select…
            </option>
            {contributors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-[11px] uppercase tracking-wider text-ink-muted">
            Who comes on (optional)
          </label>
          <select
            name="replacedByUserId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
          >
            <option value="">Not decided yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/*
            Two things said plainly because both are easy to assume
            wrongly. The person coming off STAYS on the engagement
            record — the bench is the outcome, and deleting them would
            hand the grading a clean slate. And the replacement's terms
            are open, including whether this balance pays for any of
            them.
          */}
          <p className="mt-3 text-[11px] text-ink-faint">
            The person coming off stays on this engagement&rsquo;s record.
            The bench is the result, not an erasure — it reads at
            conclusion alongside the ratings.
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            Compose the replacement&rsquo;s terms separately. Whether the
            uncommitted balance covers any of it is part of that
            conversation, not something decided here.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="disposition-reason"
          className="block text-[11px] uppercase tracking-wider text-ink-muted"
        >
          Why
        </label>
        <textarea
          id="disposition-reason"
          name="reason"
          rows={3}
          required
          placeholder="Read later by somebody deciding whether this was fair."
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending || kind === null}
          className="rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#5070F0" }}
        >
          {isPending ? "Recording…" : "Record the direction"}
        </Button>
        <span className="text-[11px] text-ink-faint">
          Set once. No money moves.
        </span>
      </div>

      {state && (
        <p
          className="text-xs"
          style={{ color: state.ok ? "#007048" : "#d84343" }}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
