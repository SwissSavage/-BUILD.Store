"use client";
import { Button } from "@/components/Button";

/**
 * Remove the unclaimed seed rows.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-21)
 *
 * Jamar has raised these accounts three times. The previous change
 * shipped a page that reported the problem and could not fix it, which
 * was over-cautious — the rule was already decided: "deleted if they
 * haven't been claimed."
 *
 * The button sends nothing. No ids, no list, no selection. The action
 * recomputes the unclaimed set server-side at execution time, so there
 * is no payload that could be altered to reach a row somebody signs in
 * as. See the WHY in seed-purge-actions.ts.
 *
 * Confirm-before-destroy is a two-click toggle rather than
 * window.confirm: a native dialog is easy to dismiss by reflex, and
 * the second state can say exactly how many rows and which surfaces
 * they come off.
 * ─────────────────────────────────────────────────────────────
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  purgeUnclaimedSeedUsers,
  type SeedPurgeResult,
} from "@/lib/seed-purge-actions";

export function SeedPurgeButton({ count }: { count: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [state, action, pending] = useActionState<SeedPurgeResult | null>(
    async () => {
      const result = await purgeUnclaimedSeedUsers();
      if (result.ok) {
        setArmed(false);
        router.refresh();
      }
      return result;
    },
    null,
  );

  if (state?.ok) {
    return (
      <p className="mt-5 rounded-xl border border-[#13A06A]/50 bg-[#13A06A]/5 px-4 py-3 text-xs text-ink">
        {state.message}
      </p>
    );
  }

  return (
    <div className="mt-5">
      {state && !state.ok && (
        <p className="mb-3 rounded-xl border border-red-500/60 bg-red-500/5 px-4 py-3 text-xs text-ink">
          {state.message}
        </p>
      )}

      {!armed ? (
        <Button
          type="button"
          onClick={() => setArmed(true)}
          className="rounded-full border border-brand-magenta/50 px-5 py-2 text-xs text-brand-magentaText hover:border-brand-magenta"
        >
          Remove {count} unclaimed row{count === 1 ? "" : "s"}
        </Button>
      ) : (
        <form action={action}>
          <p className="text-xs text-ink-muted">
            This deletes {count} user row{count === 1 ? "" : "s"} and
            everything attached to {count === 1 ? "it" : "them"} —
            notifications, portfolio items, applications. It cannot be
            undone, and it runs in one transaction so a refusal changes
            nothing. Nobody on this list has ever signed in.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={pending}
              className="rounded-full px-5 py-2 text-xs font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: "#B4245A" }}
            >
              {pending ? "Removing…" : "Yes, remove them"}
            </Button>
            <Button
              type="button"
              onClick={() => setArmed(false)}
              disabled={pending}
              className="text-xs text-ink-muted hover:text-ink disabled:opacity-60"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
