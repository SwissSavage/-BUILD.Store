"use client";

/**
 * Add a Builder who did not bid — deliberately, and only on purpose.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT IS CLOSED BY DEFAULT (2026-10-24)
 *
 * #207: "Never present the full roster as if everyone applied to the
 * RFP." A roster shown next to a bid list reads as more bids, and the
 * person skimming it at 11pm will not notice which half is which.
 *
 * So it is a closed disclosure with the exception written on the label.
 * Opening it is the admin saying out loud that this is the exceptional
 * path. Nothing about the normal pick list changes, and nobody who is
 * not looking for this will find it by accident.
 *
 * WHY THE SEARCH FILTERS RATHER THAN LISTS
 *
 * Same reason. A filter box that starts empty shows nobody; a select
 * element shows everybody. The roster only appears once an admin has
 * typed enough to be looking for a specific person, which is the only
 * state in which "add somebody who did not apply" is a sentence that
 * makes sense.
 *
 * WHY IT IS ITS OWN FORM
 *
 * Forms do not nest, and this writes an application row rather than
 * compiling a quote. Submitting it reloads the composer with the new
 * row in the pick list, unchecked — being added is not being selected.
 * ─────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from "react";
import { publicName } from "@/lib/types";
import type { User } from "@/lib/types";
import { addBuilderOutsideApplications } from "@/lib/rfp-add-builder-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export interface AddBuilderOutsideApplicationsProps {
  rfpId: string;
  /** Members who could be added — everyone already bidding is excluded. */
  candidates: User[];
}

const field =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs";
const key = "text-[10px] uppercase tracking-wider text-ink-muted";

export function AddBuilderOutsideApplications({
  rfpId,
  candidates,
}: AddBuilderOutsideApplicationsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<User | null>(null);
  const [priceMode, setPriceMode] = useState<"hourly" | "fixed">("hourly");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return candidates
      .filter((u) =>
        [publicName(u), u.handle, u.tagline, u.primaryIndustry]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [candidates, query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
      >
        Add a Builder who didn&apos;t apply →
      </button>
    );
  }

  return (
    <Card className="mt-4 border-brand-magenta/40">
      <CardEyebrow>Exception</CardEyebrow>
      <CardTitle>Add a Builder outside applications</CardTitle>
      <p className="mt-1 text-xs text-ink-muted">
        For somebody who never bid on this RFP. They arrive on the pick
        list marked <span className="font-medium">Admin-added</span> and
        unchecked, and they are told that you put them forward — so
        confirm the role, hours and price with them first rather than
        guessing.
      </p>

      <form action={addBuilderOutsideApplications} className="mt-4 space-y-3">
        <input type="hidden" name="rfpId" value={rfpId} />

        <label className="block">
          <span className={key}>Who</span>
          <input
            value={picked ? publicName(picked) : query}
            onChange={(e) => {
              setPicked(null);
              setQuery(e.target.value);
            }}
            placeholder="Search by name, handle or industry"
            className={field}
          />
        </label>
        {picked ? (
          <input type="hidden" name="userId" value={picked.id} />
        ) : (
          matches.length > 0 && (
            <ul className="divide-y divide-[var(--surface-border)] rounded-lg border border-[var(--surface-border)]">
              {matches.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(u);
                      setQuery("");
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-elevated)]"
                  >
                    <span className="font-medium">{publicName(u)}</span>
                    <span className="ml-2 text-ink-faint">
                      @{u.handle ?? "—"}
                      {u.tagline ? ` · ${u.tagline}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
        {!picked && query.trim().length >= 2 && matches.length === 0 && (
          <p className="text-[11px] text-ink-faint">
            Nobody matches. People already bidding on this RFP are not
            listed — use their bid instead.
          </p>
        )}

        <label className="block">
          <span className={key}>Role</span>
          <input
            name="proposedRole"
            placeholder="What they are being brought in to do"
            className={field}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={key}>Hours per week</span>
            <input name="hoursPerWeek" inputMode="numeric" className={field} />
          </label>
          <label className="block">
            <span className={key}>Up to (optional)</span>
            <input
              name="hoursPerWeekMax"
              inputMode="numeric"
              className={field}
            />
          </label>
        </div>

        <fieldset>
          <span className={key}>Payout terms</span>
          <div className="mt-1 flex gap-4 text-xs">
            {(["hourly", "fixed"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="priceMode"
                  value={mode}
                  checked={priceMode === mode}
                  onChange={() => setPriceMode(mode)}
                />
                {mode === "hourly" ? "Hourly" : "Project price"}
              </label>
            ))}
          </div>
        </fieldset>

        {priceMode === "hourly" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className={key}>Their rate ($/hr)</span>
              <input name="hourlyRate" inputMode="decimal" className={field} />
            </label>
            <label className="block">
              <span className={key}>Up to (optional)</span>
              <input
                name="hourlyRateMax"
                inputMode="decimal"
                className={field}
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className={key}>Their project price ($)</span>
              <input
                name="fixedPriceMin"
                inputMode="decimal"
                className={field}
              />
            </label>
            <label className="block">
              <span className={key}>Up to (optional)</span>
              <input
                name="fixedPriceMax"
                inputMode="decimal"
                className={field}
              />
            </label>
          </div>
        )}
        <p className="text-[11px] text-ink-faint">
          This is what they are paid. The client price is set on their
          card once they are on the pick list.
        </p>

        <label className="block">
          <span className={key}>Why them, without a bid</span>
          <textarea
            name="adminNote"
            rows={2}
            placeholder="Goes in the audit trail and on their notification."
            className={field}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!picked}
            className="fm-btn-primary rounded-full px-5 py-2 text-xs font-medium disabled:opacity-50"
          >
            Add to the pick list
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPicked(null);
              setQuery("");
            }}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
