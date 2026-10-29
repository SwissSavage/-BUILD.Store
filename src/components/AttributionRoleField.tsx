"use client";

/**
 * Role and weight, where the weight only exists for one of the pools.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-29)
 *
 * The attribution form offered four roles and a weight box, as though
 * all four worked the same way. They do not.
 *
 *   contributor, delivery_lead   feed the 85% pool, proportionally.
 *                                The settle page normalises, so the
 *                                weight is relative to the others.
 *   introducer, advisor          feed the 12% pool, which splits
 *                                evenly across the contract's admin
 *                                list and never reads a weight at all.
 *
 * So picking Introducer and typing 0.5 looked like buying half a
 * share, and the number went nowhere. Worse, it made a nomination look
 * like a payment, which is the one thing that must not be ambiguous on
 * a page that decides what people are owed.
 *
 * The weight now appears only when it means something, and the admin
 * roles say what they actually do.
 *
 * WHY THE DEFAULT IS 1 AND NOT 0.5
 *
 * The old default was 0.5, which is how Ozy ended up logged at 0.50 on
 * a contract she delivered single-handed. Nothing calculated that
 * number; the field was pre-filled and nobody changed it. Weights are
 * relative, so one contributor at 1.00 reads as the whole job, which
 * is the common case and the honest default.
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import {
  ATTRIBUTION_ROLE_LABELS,
  rolePool,
  type AttributionRole,
} from "@/lib/types";

const selectClass =
  "mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2";
const key = "text-xs uppercase tracking-wider text-ink-muted";

export function AttributionRoleField() {
  const [role, setRole] = useState<AttributionRole>("contributor");
  const pool = rolePool(role);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={key}>Role</span>
          <select
            name="role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value as AttributionRole)}
            className={selectClass}
          >
            {(Object.keys(ATTRIBUTION_ROLE_LABELS) as AttributionRole[]).map(
              (r) => (
                <option key={r} value={r}>
                  {ATTRIBUTION_ROLE_LABELS[r]}
                  {rolePool(r) === "admin" ? " (admin pool)" : ""}
                </option>
              ),
            )}
          </select>
        </label>

        {pool === "contributor" ? (
          <label className="block">
            <span className={key}>Weight</span>
            <input
              name="weight"
              type="number"
              min="0"
              max="1"
              step="0.05"
              defaultValue="1"
              required
              className={selectClass}
            />
            <span className="mt-1 block text-[11px] text-ink-faint">
              Relative to the other contributors, not a percentage. One
              person at any value takes the whole pool.
            </span>
          </label>
        ) : (
          <div className="block">
            <span className={key}>Weight</span>
            <div className="mt-2 rounded-lg border border-dashed border-[var(--surface-border)] px-3 py-2 text-sm text-ink-muted">
              Not used
            </div>
            {/* The action still requires a weight, so post a zero
                rather than making the server care which pool it is. */}
            <input type="hidden" name="weight" value="0" />
            <span className="mt-1 block text-[11px] text-ink-faint">
              The 12% pool splits evenly across the contract&apos;s
              admin list. This entry nominates them for that list; it
              does not pay them.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
