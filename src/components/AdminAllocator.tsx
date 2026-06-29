"use client";

/**
 * Client-side allocator for the admin pool on the settlement page.
 *
 * Why a client component: the spreadsheet model says any number of admins can
 * share the commission pool (a multimillion-dollar Solana proposal had 5).
 * Add/remove rows + percentage rebalancing needs local state. The form
 * submits parallel `adminId[]` / `adminPct[]` arrays back to the server
 * action, which validates and writes the split rows.
 */
import { useMemo, useState } from "react";

export interface AdminCandidate {
  id: string;
  name: string;
  stripePayoutsEnabled: boolean;
}

interface Row {
  userId: string;
  pct: number;
}

export function AdminAllocator({
  candidates,
  initialAdminIds,
  adminPool,
  /** Default share per row when added/added — typically 100/N. */
  defaultEvenSplit,
}: {
  candidates: AdminCandidate[];
  initialAdminIds: string[];
  adminPool: number;
  defaultEvenSplit: boolean;
}) {
  const seedRows: Row[] = useMemo(() => {
    if (initialAdminIds.length === 0) return [];
    const even = 100 / initialAdminIds.length;
    return initialAdminIds.map((id) => ({
      userId: id,
      pct: defaultEvenSplit ? Number(even.toFixed(2)) : 0,
    }));
  }, [initialAdminIds, defaultEvenSplit]);

  const [rows, setRows] = useState<Row[]>(seedRows);

  const total = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const totalGood = Math.abs(total - 100) < 0.01;

  // True when every row is within 0.01% of an even N-way split. Lets us
  // show the friendly "even split" label rather than confusing the eye
  // with identical percentages on every row.
  const evenSplit = useMemo(() => {
    if (rows.length === 0) return false;
    const expected = 100 / rows.length;
    return rows.every((r) => Math.abs((Number(r.pct) || 0) - expected) < 0.01);
  }, [rows]);

  const used = new Set(rows.map((r) => r.userId));
  const remaining = candidates.filter((c) => !used.has(c.id));

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      // Re-balance to even split after removal so user isn't stuck off-100%.
      if (next.length === 0) return next;
      const even = Number((100 / next.length).toFixed(2));
      return next.map((r) => ({ ...r, pct: even }));
    });
  }
  function addRow(userId: string) {
    setRows((prev) => {
      const next: Row[] = [...prev, { userId, pct: 0 }];
      const even = Number((100 / next.length).toFixed(2));
      return next.map((r) => ({ ...r, pct: even }));
    });
  }
  function rebalanceEven() {
    if (rows.length === 0) return;
    const even = Number((100 / rows.length).toFixed(2));
    setRows(rows.map((r) => ({ ...r, pct: even })));
  }

  return (
    <div className="mt-4">
      {rows.length === 0 ? (
        <p className="rounded-lg bg-[var(--surface-inset)] px-4 py-3 text-sm text-ink-muted">
          No admins on this contract yet. Add one or more below — the admin
          pool can&apos;t be settled until at least one admin is allocated.
        </p>
      ) : (
        <>
          {evenSplit && rows.length > 1 && (
            <p className="mb-2 text-xs text-ink-faint">
              Even split across {rows.length} admins ({(100 / rows.length).toFixed(2)}% each).
              Edit any row below if a different share was negotiated.
            </p>
          )}
          <table className="w-full text-sm">
          <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="py-2 text-left">Admin</th>
              <th className="py-2 text-right">Share</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const c = candidates.find((c) => c.id === row.userId);
              const amount = (adminPool * (Number(row.pct) || 0)) / 100;
              return (
                <tr
                  key={row.userId}
                  className="border-b border-[var(--surface-border)]"
                >
                  <td className="py-3">
                    <input type="hidden" name="adminId" value={row.userId} />
                    <div className="font-medium">{c?.name ?? row.userId}</div>
                    {c && !c.stripePayoutsEnabled && (
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: "#E53E3E" }}
                      >
                        Stripe payouts not enabled — transfer will fail.
                      </p>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <input
                      name="adminPct"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={row.pct}
                      onChange={(e) =>
                        updateRow(i, { pct: Number(e.target.value) })
                      }
                      className="w-24 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-right text-sm"
                    />
                    <span className="ml-1 text-ink-faint">%</span>
                  </td>
                  <td className="py-3 text-right text-ink-muted">
                    ≈ $
                    {amount.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-xs text-ink-faint hover:text-[var(--brand-magenta,#D828A0)]"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs">
          {rows.length > 0 && (
            <span style={{ color: totalGood ? "#007048" : "#E53E3E" }}>
              Total: {total.toFixed(2)}% {totalGood ? "✓" : "(must be 100%)"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 1 && !evenSplit && (
            <button
              type="button"
              onClick={rebalanceEven}
              className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-inset)]"
            >
              Reset to even split
            </button>
          )}
          {remaining.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addRow(e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            >
              <option value="">+ Add admin…</option>
              {remaining.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
