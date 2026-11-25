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
 * This is never shown to the person it describes. An admin records
 * what somebody DID, and that decides which questions OTHER people
 * are asked ABOUT them. Nobody is ever asked about their own role.
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
import {
  AXIS_SUB_RATING,
  ENGAGEMENT_ROLES,
  axesFor,
  axisDefinition,
} from "@/lib/engagement-roles";
import { subRatingLabel } from "@/lib/mvp-score";

type FormState = RoleAssignResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return setEngagementRoles(formData);
}


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
      <div className="mt-2 text-[11px] text-ink-faint">
        {axes.length === 0 ? (
          <p>
            No roles yet, so {personName} cannot be reviewed. Pick what
            they actually did.
          </p>
        ) : (
          <>
            <p>
              {personName} will be rated on {axes.length} thing
              {axes.length === 1 ? "" : "s"}, each feeding the sub-rating
              beside it:
            </p>
            {/*
              The sub-rating is named because that is the actual
              consequence. Ticking Payments does not produce a private
              PM score, it puts somebody's Reliability — 16% of their
              OVR, the heaviest single dimension — on whether the money
              went out when they said it would. An admin assigning roles
              should see that before saving, not discover it later.
            */}
            <ul className="mt-1 space-y-0.5">
              {axes.map((a) => (
                <li key={a}>
                  <span className="text-ink-muted">
                    {axisDefinition(a)?.label ?? a}
                  </span>{" "}
                  → {subRatingLabel(AXIS_SUB_RATING[a])}
                </li>
              ))}
            </ul>
            {!axes.includes("paidOnTime") && (
              <p className="mt-1">And never on paying on time.</p>
            )}
          </>
        )}
      </div>

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
