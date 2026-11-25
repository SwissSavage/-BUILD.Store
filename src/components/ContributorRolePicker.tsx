/**
 * What somebody DELIVERED on an engagement.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THE ADMIN PICKER (2026-11-25)
 *
 * The six engagement roles describe running a deal — holding the
 * client, directing the work, paying people. Offering them for the
 * person who did the work meant reviewers could be asked whether a
 * designer handled payments. Jamar: "I was giving the 6 roles as
 * examples for admin specifically", and "It's misattributing her
 * role."
 *
 * Delivery is not a mirror of management. Craft, reliability,
 * collaboration and communication apply to anyone who delivered, so
 * those need no gating at all. The one thing that varies is
 * accountability for the outcome: "a delivery lead is ultimately in
 * part responsible for what gets delivered if their failure to
 * communicate is what caused a poor outcome that needs
 * documentation."
 *
 * ─────────────────────────────────────────────────────────────
 * NOBODY IS ASKED ABOUT THEIR OWN ROLE
 *
 * This control is an admin's record of what a person did. It decides
 * which questions OTHER people get about them. It is never shown to
 * the person it describes, and nobody fills in a form about
 * themselves anywhere in this system.
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
  CONTRIBUTOR_AXES,
  CONTRIBUTOR_ROLES,
  contributorAxesFor,
} from "@/lib/engagement-roles";

type FormState = RoleAssignResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return setEngagementRoles(formData);
}

export function ContributorRolePicker({
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

  const extra = contributorAxesFor(picked);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="userId" value={userId} />

      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        What did {personName} deliver on this engagement?
      </p>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {CONTRIBUTOR_ROLES.map((r) => (
          <label
            key={r.role}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--surface-border)] px-2.5 py-2 text-sm hover:border-brand-magenta has-[:checked]:border-brand-magenta"
          >
            <input
              type="checkbox"
              name="roles"
              value={r.role}
              checked={picked.includes(r.role)}
              onChange={() =>
                setPicked((p) =>
                  p.includes(r.role)
                    ? p.filter((x) => x !== r.role)
                    : [...p, r.role],
                )
              }
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

      <p className="mt-2 text-[11px] text-ink-faint">
        Everyone who delivered is rated on craft, reliability,
        collaboration and communication.
        {extra.length > 0 ? (
          <>
            {" "}
            As delivery lead, {personName} is also asked about{" "}
            <span className="text-ink-muted">
              {extra
                .map((a) => CONTRIBUTOR_AXES.find((x) => x.axis === a)?.label)
                .filter(Boolean)
                .join(", ")}
            </span>
            {" "}— whether the work stayed joined up, which a contributor
            is not accountable for.
          </>
        ) : (
          " Nothing extra is asked about a contributor."
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#5070F0" }}
        >
          {isPending ? "Saving…" : "Save"}
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
