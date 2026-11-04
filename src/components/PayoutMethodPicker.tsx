/**
 * Which rail this participant gets paid on, chosen per person.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03) — the model is task #113.
 *
 * Jamar: "payout method needs to be manually selected for each
 * participant."
 *
 * Not read off the recipient's profile. payout_methods is a per-user
 * registry members do not maintain, and a registry nobody fills in
 * cannot decide where money goes. The admin sends the money, so the
 * admin picks the rail — and the same person can be paid differently
 * on different engagements without editing a profile, which is what
 * happens the first time someone outside the US is on a settlement.
 *
 * WHAT THIS REPLACED
 *
 * A red line reading "Stripe payouts not enabled — transfer will
 * fail", shown to everybody, because settle attempted a Connect
 * transfer for every recipient regardless. It described a transfer
 * nobody intended to make, and the split landed `failed` for the
 * ordinary case of being paid by ACH. Picking the rail here means the
 * split lands `awaiting_manual` and `failed` goes back to meaning
 * something broke.
 *
 * The field name carries the user id, `payoutMethod:<userId>`, so one
 * flat form can express a choice per participant without the server
 * having to pair two parallel arrays by index.
 * ─────────────────────────────────────────────────────────────
 */
import {
  methodsReaching,
  type PayoutMethodDefinition,
} from "@/lib/payout-protocols";

interface Props {
  userId: string;
  /**
   * ISO-3166-1 alpha-2. Filters out rails that cannot reach them —
   * Found and check are US-only. Defaults to US until the schema
   * carries a country, which it does not yet.
   */
  country?: string | null;
  /** Pre-selects a rail, e.g. the one they were paid on last time. */
  defaultMethodId?: string | null;
}

export function PayoutMethodPicker({
  userId,
  country,
  defaultMethodId,
}: Props) {
  const options: PayoutMethodDefinition[] = methodsReaching(country);

  if (options.length === 0) {
    // Honest rather than empty. A recipient no configured rail can
    // reach is a real situation that needs a decision, not a silently
    // blank dropdown that settles them to nowhere.
    return (
      <p className="mt-1 text-xs" style={{ color: "var(--fm-red-text)" }}>
        No configured payout method reaches this recipient. Settling will
        leave their share awaiting a manual send.
      </p>
    );
  }

  const selected =
    options.find((m) => m.id === defaultMethodId) ?? options[0];

  return (
    <div className="mt-1">
      <label
        htmlFor={`payoutMethod-${userId}`}
        className="sr-only"
      >
        Payout method
      </label>
      <select
        id={`payoutMethod-${userId}`}
        name={`payoutMethod:${userId}`}
        defaultValue={selected.id}
        className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {selected.note && (
        <p className="mt-1 max-w-sm text-[11px] text-ink-faint">
          {selected.note}
        </p>
      )}
    </div>
  );
}
