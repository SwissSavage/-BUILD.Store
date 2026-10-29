/**
 * Who owns this project, as a deliberate choice.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-16)
 *
 * Jamar: "specific admins aren't listed/attached to each project.
 * It's going to usually be me for now, that should be something that
 * gets selected manually."
 *
 * adminUserIds was empty on everything that did not come through
 * composeEngagement or the contract poster, and empty is not cosmetic:
 *
 *   - the executive pool at settlement (80% of the commission, for project
 *     managers and advisors) has no recipient
 *   - /api/engagements/[id]/attachments/[idx] checks adminUserIds for
 *     entitlement, so an admin who should be able to open a reference
 *     file gets a 403
 *   - milestone overdue escalation fans out to projectAdminUserIds(),
 *     so a past-due milestone on an unowned project notifies nobody
 *
 * WHY MANUAL AND NOT A SILENT DEFAULT
 *
 * Defaulting to whoever clicked approve would make the field correct
 * today and wrong quietly forever after, because nobody would ever see
 * it. Pre-checking the current admin and showing the box is the
 * difference between a default and an assumption: the common case is
 * one click, and the uncommon case is visible.
 *
 * Nobody selected is allowed. An RFP can be approved before it has an
 * owner, and forcing a name here would just teach people to pick one
 * at random. The consequences above are surfaced where they bite
 * rather than blocked here.
 * ─────────────────────────────────────────────────────────────
 */
import { adminName } from "@/lib/types";
import type { User } from "@/lib/types";

export function AdminOwnerField({
  admins,
  selected,
  currentAdminId,
  label = "Executive share",
  hint,
}: {
  /**
   * Anyone who can be put on the 12% executive pool. NOT the people
   * flagged isAdmin, which is a platform permission and a different
   * question entirely: Rob runs deals and is not an app administrator,
   * so filtering on that flag made him impossible to attach to one.
   * Members and partners, excluding viewers and suspended accounts.
   */
  admins: User[];
  /** Already on the project. */
  selected: string[];
  /** Pre-checked when the project has no owner yet. */
  currentAdminId?: string;
  label?: string;
  hint?: string;
}) {
  const chosen = new Set(selected);
  // Only pre-check when nothing is set. An existing selection is
  // somebody's decision and does not get overwritten by whoever
  // happens to have opened the form.
  const preCheck = chosen.size === 0 && currentAdminId ? currentAdminId : null;

  return (
    <fieldset>
      <legend className="block text-xs text-ink-muted">{label}</legend>
      <p className="mt-1 text-[11px] text-ink-faint">
        {hint ??
          "Drives the admin share at settlement, who can open reference files, and who hears about an overdue milestone."}
      </p>
      <div className="mt-2 space-y-1.5">
        {admins.length === 0 ? (
          <p className="text-xs text-ink-faint">No admins on the roster.</p>
        ) : (
          admins.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2.5 rounded-lg bg-[var(--surface-inset)] px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="adminUserIds"
                value={a.id}
                defaultChecked={chosen.has(a.id) || preCheck === a.id}
              />
              <span>{adminName(a)}</span>
              {preCheck === a.id && (
                <span className="text-[10px] text-ink-faint">(you)</span>
              )}
            </label>
          ))
        )}
      </div>
      {/* Lets the server tell "nobody was selected" apart from "this
          form does not carry the field", which is the difference
          between clearing the owners and leaving them alone. */}
      <input type="hidden" name="adminUserIdsPresent" value="1" />
    </fieldset>
  );
}
