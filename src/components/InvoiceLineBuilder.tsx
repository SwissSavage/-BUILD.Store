"use client";

/**
 * Invoice lines that show their own arithmetic.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-27)
 *
 * The draft form was two boxes: a description and an amount. Jamar
 * typed "Ozy Design Services $65/hr" into one and a total into the
 * other, and the app had no opinion about whether those agreed with
 * each other or with the contract.
 *
 * His ask: "Attach builder, Service Rate (should come from contract),
 * Unit Price, Units, Discount (Optional), Final Price, and it should
 * be calculated automatically. Purpose being to keep the record
 * uniform from end to end with a record of any discounts that can be
 * assessed or justified at a later date."
 *
 * WHY THE SERVICE RATE IS READ-ONLY AND THE UNIT PRICE IS NOT
 *
 * They answer different questions. The service rate is what the client
 * agreed to, and an invoice is not the place to edit that. The unit
 * price is what is being billed on this line, which is usually the
 * same and sometimes deliberately is not.
 *
 * When they differ, the gap is a discount whether or not anybody calls
 * it one, so the row says so and folds it into the same reason field.
 * A quiet rate reduction and a stated discount have identical effects
 * on the total and completely different meanings a year later, which
 * is the thing being protected against.
 *
 * WHY THE REASON IS REQUIRED
 *
 * The entire stated purpose is being able to justify a discount later.
 * A number with no reason beside it cannot be justified or assessed. A
 * goodwill write-off and a correction of an overbill look the same
 * once they are both just a smaller total.
 *
 * DISPLAY ONLY. The server recomputes every line with the same
 * invoiceLineTotals before writing. A number typed into a form is a
 * suggestion until the server has agreed with it.
 * ─────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from "react";
import { invoiceLineTotals, publicName } from "@/lib/types";
// Both from types.ts deliberately: invoice-contract-rates.ts reaches
// src/db/client.ts, and check-client-boundary refuses that import from
// a "use client" file even when it is type-only.
import type { ContractRate, User } from "@/lib/types";

export interface InvoiceLineBuilderProps {
  rates: ContractRate[];
  roster: User[];
}

interface Row {
  key: string;
  builderUserId: string;
  description: string;
  unitPrice: string;
  units: string;
  discount: string;
  discountReason: string;
}

function emptyRow(): Row {
  return {
    key: Math.random().toString(36).slice(2),
    builderUserId: "",
    description: "",
    unitPrice: "",
    units: "",
    discount: "",
    discountReason: "",
  };
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const field =
  "w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs";
const key = "text-[10px] uppercase tracking-wider text-ink-muted";

export function InvoiceLineBuilder({ rates, roster }: InvoiceLineBuilderProps) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const rateByUser = useMemo(
    () => new Map(rates.map((r) => [r.userId, r])),
    [rates],
  );
  const nameById = useMemo(
    () => new Map(roster.map((u) => [u.id, publicName(u)])),
    [roster],
  );

  const set = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const computed = rows.map((r) => {
    const contract = rateByUser.get(r.builderUserId) ?? null;
    const totals = invoiceLineTotals(r);
    const contractRate = contract?.rate ? Number(contract.rate) : null;
    const typed = Number(r.unitPrice);
    // A unit price under the agreed rate is a discount whether or not
    // it was entered in the discount box.
    const impliedPerUnit =
      contractRate !== null && Number.isFinite(typed) && typed > 0
        ? Math.max(0, contractRate - typed)
        : 0;
    const impliedTotal =
      Math.round(impliedPerUnit * (Number(r.units) || 0) * 100) / 100;
    return { row: r, contract, totals, impliedTotal };
  });

  const subtotal =
    Math.round(
      computed.reduce((acc, c) => acc + c.totals.final, 0) * 100,
    ) / 100;
  const discountTotal =
    Math.round(
      computed.reduce((acc, c) => acc + c.totals.discount + c.impliedTotal, 0) *
        100,
    ) / 100;

  return (
    <div className="mt-4 space-y-4">
      {computed.map(({ row, contract, totals, impliedTotal }, i) => {
        const needsReason =
          (totals.discount > 0 || impliedTotal > 0) &&
          row.discountReason.trim().length === 0;
        return (
          <div
            key={row.key}
            className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className={key}>Line {i + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) => rs.filter((r) => r.key !== row.key))
                  }
                  className="text-[11px] text-ink-muted hover:text-ink"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="block">
                <span className={key}>Builder</span>
                <select
                  name="builderUserId"
                  value={row.builderUserId}
                  onChange={(e) => {
                    const r = rateByUser.get(e.target.value);
                    set(row.key, {
                      builderUserId: e.target.value,
                      // Default the billed price to the agreed rate, so
                      // the common case is no typing and no drift.
                      unitPrice: r?.rate ?? row.unitPrice,
                    });
                  }}
                  className={field}
                >
                  <option value="">Not builder-specific</option>
                  {rates.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {nameById.get(r.userId) ?? r.userId}
                      {r.rate ? ` — ${usd(Number(r.rate))}` : " — no rate set"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={key}>Description</span>
                <input
                  name="description"
                  value={row.description}
                  onChange={(e) => set(row.key, { description: e.target.value })}
                  placeholder="What this line is for"
                  className={field}
                />
              </label>
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <div>
                <span className={key}>Service rate</span>
                <div className="mt-1 rounded-lg border border-dashed border-[var(--surface-border)] px-2 py-1.5 text-xs tabular-nums text-ink-muted">
                  {contract?.rate ? usd(Number(contract.rate)) : "—"}
                </div>
                <span className="mt-0.5 block text-[10px] text-ink-faint">
                  {contract
                    ? contract.source === "quote"
                      ? "from the approved quote"
                      : "from the engagement terms"
                    : "pick a Builder"}
                </span>
              </div>

              <label className="block">
                <span className={key}>Unit price</span>
                <input
                  name="unitPrice"
                  inputMode="decimal"
                  value={row.unitPrice}
                  onChange={(e) => set(row.key, { unitPrice: e.target.value })}
                  className={`${field} mt-1 tabular-nums`}
                />
              </label>

              <label className="block">
                <span className={key}>
                  Units{contract ? ` (${contract.unitLabel})` : ""}
                </span>
                <input
                  name="units"
                  inputMode="decimal"
                  value={row.units}
                  onChange={(e) => set(row.key, { units: e.target.value })}
                  className={`${field} mt-1 tabular-nums`}
                />
              </label>

              <label className="block">
                <span className={key}>Discount (optional)</span>
                <input
                  name="discount"
                  inputMode="decimal"
                  value={row.discount}
                  onChange={(e) => set(row.key, { discount: e.target.value })}
                  className={`${field} mt-1 tabular-nums`}
                />
              </label>
            </div>

            {(totals.discount > 0 || impliedTotal > 0) && (
              <label className="mt-2 block">
                <span className={key}>
                  Why the discount
                  {needsReason && (
                    <span className="ml-1 normal-case tracking-normal text-brand-magentaText">
                      required
                    </span>
                  )}
                </span>
                <input
                  name="discountReason"
                  value={row.discountReason}
                  onChange={(e) =>
                    set(row.key, { discountReason: e.target.value })
                  }
                  placeholder="So it can be justified a year from now"
                  className={`${field} mt-1`}
                  style={
                    needsReason
                      ? { borderColor: "var(--fm-magenta-text)" }
                      : undefined
                  }
                />
                {impliedTotal > 0 && (
                  <span className="mt-1 block text-[10px] text-ink-faint">
                    The unit price is below the agreed rate, which is a
                    further {usd(impliedTotal)} off this line.
                  </span>
                )}
              </label>
            )}

            <div className="mt-3 flex items-baseline justify-between border-t border-[var(--surface-border)] pt-2">
              <span className={key}>Line total</span>
              <span className="text-xs font-medium tabular-nums">
                {usd(totals.gross)}
                {totals.discount > 0 && (
                  <span className="text-ink-muted">
                    {" "}
                    − {usd(totals.discount)} ={" "}
                  </span>
                )}
                {totals.discount > 0 && <strong>{usd(totals.final)}</strong>}
              </span>
            </div>

            {/* One hidden marker per row so the server can count rows
                without guessing from parallel array lengths. */}
            <input type="hidden" name="lineIndex" value={i} />
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
        >
          Add another line
        </button>
        <div className="text-right">
          {discountTotal > 0 && (
            <div className="text-[11px] text-ink-muted">
              {usd(discountTotal)} discounted across the invoice
            </div>
          )}
          <div className="font-display text-xl font-semibold tabular-nums">
            {usd(subtotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
