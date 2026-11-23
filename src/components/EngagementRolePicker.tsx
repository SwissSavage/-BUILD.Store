/**
 * Say what somebody did on an engagement.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT SITS NEXT TO THE REVIEW (2026-11-23)
 *
 * Jamar: "Rob doesn't handle payments, that should be made clear at
 * role assignment not left to be inferred by questions."
 *
 * Scope is declared here and nowhere else. No default, no inference
 * from the split, no guessing which questions are fair: axesFor
 * returns nothing without roles, so this control is what makes a
 * review askable at all.
 *
 * It lives beside the person it describes rather than on a settings
 * screen somewhere earlier, because that is what "optional" meant —
 * not a mandatory step in advance, but a five-second thing done by
 * whoever is already looking at the engagement.
 *
 * WHY THE AXES ARE SHOWN AS YOU TICK
 *
 * The consequence of a role is not obvious from its name. An admin
 * ticking "Coordination" should be able to see that they have just
 * made this person answerable for absorbing client churn, and that
 * they have NOT made them answerable for paying on time. The whole
 * point is that scope is explicit, which it is not if the effect is
 * invisible until somebody is rated.
 *
 * Presentational only: everything arrives as a prop.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import {
  setEngagementRoles,
  type RoleAssignResult,
} from "@/lib/engagement-role-actions";
import { ENGAGEMENT_ROLES, axesFor } from "@/lib/engagement-roles";

type FormState = RoleAssignResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return setEngagementRoles(formData);
}

const AXIS_LABEL: Record<string, string> = {
  scopeClarity: "Scope clarity",
  responsiveness: "Responsiveness",
  shieldedFromChurn: "Handling change",
  paidOnTime: "Paid on time",
};

export function EngagementRolePicker({
  projectId,
  userId,
  personName,
  current,
}: {
  projectId: string;
  userId: string;
  personName: string;
  current: string[];
}) {
  const [picked, setPicked] = useState<string[]>(current);
  const [state, formAction, isPending] = useActionState(action, null);

  const toggle = (role: string) =>
    setPicked((p) =>
      p.includes(role) ? p.filter((r) => r !== role) : [...p, role],
    );

  const axes = axesFor(picked);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="userId" value={userId} />

      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        What did {personName} do on this engagement?
      </p>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {ENGAGEMENT_ROLES.map((r) => (
          <label
            key={r.role}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--surface-border)] px-2.5 py-2 text-sm hover:border-brand-magenta has-[:checked]:border-brand-magenta"
          >
            <input
              type="checkbox"
              name="roles"
              value={r.role}
              checked={picked.includes(r.role)}
              onChange={() => toggle(r.role)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="font-medium">{r.label}</span>
              <span className="block text-[11px] text-ink-faint">
                {r.describes}
              </span>
            </span>
          </label>
        ))}
      </div>

      {/*
        The consequence, visible while choosing. Ticking Coordination
        makes somebody answerable for absorbing churn and not for
        paying on time, and an admin should not have to know the axis
        map to see that.
      */}
      <p className="mt-2 text-[11px] text-ink-faint">
        {axes.length === 0 ? (
          <>
            No roles yet, so {personName} cannot be reviewed. Pick what
            they actually did.
          </>
        ) : (
          <>
            {personName} will be rated on{" "}
            <span className="text-ink-muted">
              {axes.map((a) => AXIS_LABEL[a]).join(", ")}
            </span>
            {!axes.includes("paidOnTime") && (
              <span> — and never on paying on time.</span>
            )}
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#5070F0" }}
        >
          {isPending ? "Saving…" : "Save roles"}
        </Button>
        {state && (
          <span
            className="text-xs"
            style={{ color: state.ok ? "#007048" : "#d84343" }}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
