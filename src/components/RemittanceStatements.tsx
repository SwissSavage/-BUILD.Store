/**
 * Your payout statements, and the two buttons that make them evidence.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-29)
 *
 * This is the self-billing half the member sees. The cooperative issues
 * the statement instead of asking for an invoice, so the only thing
 * that turns it from an assertion into a record is the recipient saying
 * the number is right.
 *
 * Confirm is one click. Dispute is one click plus a sentence, and it is
 * on the same card at the same size, because a statement you can only
 * agree with is not evidence of agreement. The person most likely to
 * have been shorted is the least likely to chase it if chasing means
 * starting a conversation.
 *
 * The basis block is rendered from the frozen snapshot on the row, not
 * from the live split. If someone later corrects an allocation, this
 * still shows what they were told, which is the entire point of the
 * table being a snapshot.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  acknowledgeRemittance,
  disputeRemittance,
} from "@/lib/remittance-actions";

export interface StatementView {
  id: string;
  contractTitle: string;
  pool: string;
  cashAmount: number;
  voucherAmount: number;
  sharePct: number | null;
  basis: { label: string; value: string }[];
  issuedAt: string;
  acknowledgedAt: string | null;
  disputedAt: string | null;
  disputeNote: string | null;
}

const POOL_LABEL: Record<string, string> = {
  contributor: "Delivery",
  admin: "Executive share",
  treasury: "Treasury",
  liquidity_pool: "Liquidity pool",
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function RemittanceStatements({
  statements,
}: {
  statements: StatementView[];
}) {
  const unconfirmed = statements.filter(
    (s) => !s.acknowledgedAt && !s.disputedAt,
  ).length;

  return (
    <Card className="mt-6">
      <CardEyebrow>Payout statements</CardEyebrow>
      <CardTitle className="mt-2">
        What you were paid, and why that number
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        You don&apos;t invoice us. When a contract settles we issue the
        statement from the engagement rate, the attribution ledger and the
        milestone record, and you confirm it. That confirmation is the
        record — it&apos;s stronger than an invoice, because the figures
        come out of the rows we actually paid from rather than being typed
        out again from memory.
      </p>

      {unconfirmed > 0 && (
        <p className="mt-3 text-sm font-medium text-brand-magentaText">
          {unconfirmed} statement{unconfirmed === 1 ? "" : "s"} waiting on
          you.
        </p>
      )}

      {statements.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          Nothing yet. A statement appears here the moment a contract
          you&apos;re attributed to settles, and you&apos;ll get a
          notification at the same time.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {statements.map((s) => (
            <Statement key={s.id} statement={s} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Statement({ statement: s }: { statement: StatementView }) {
  const [disputing, setDisputing] = useState(false);

  const status = s.disputedAt
    ? { label: "Disputed", color: "#E53E3E" }
    : s.acknowledgedAt
      ? { label: "Confirmed", color: "#007048" }
      : { label: "Awaiting your confirmation", color: "#5070F0" };

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{s.contractTitle}</div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {POOL_LABEL[s.pool] ?? s.pool} · issued {day(s.issuedAt)}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${status.color}26`,
            color: status.color,
          }}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            Cash
          </div>
          <div className="font-display text-2xl font-semibold">
            {usd(s.cashAmount)}
          </div>
        </div>
        {s.voucherAmount > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              $BUILD
            </div>
            <div className="font-display text-2xl font-semibold text-brand-magentaText">
              {s.voucherAmount.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {s.basis.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {s.basis.map((b, i) => (
            <div key={i} className="flex justify-between gap-3">
              <dt className="text-ink-muted">{b.label}</dt>
              <dd className="text-right">{b.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {s.disputedAt && (
        <div
          className="mt-4 rounded-lg border-l-4 bg-[var(--surface-elevated)] p-3 text-sm"
          style={{ borderLeftColor: "#E53E3E" }}
        >
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            You disputed this on {day(s.disputedAt)}
          </p>
          {s.disputeNote && <p className="mt-1">{s.disputeNote}</p>}
          <p className="mt-2 text-xs text-ink-faint">
            The admins on the deal were notified. If it&apos;s been sorted
            out, confirm below and the dispute closes.
          </p>
        </div>
      )}

      {s.acknowledgedAt && (
        <p className="mt-4 text-xs text-ink-faint">
          You confirmed this on {day(s.acknowledgedAt)}.
        </p>
      )}

      {!s.acknowledgedAt && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form action={acknowledgeRemittance}>
            <input type="hidden" name="remittanceId" value={s.id} />
            <Button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#007048" }}
            >
              This is right
            </Button>
          </form>
          {!disputing && !s.disputedAt && (
            <Button
              type="button"
              onClick={() => setDisputing(true)}
              className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium hover:bg-[var(--surface-elevated)]"
            >
              Something&apos;s wrong
            </Button>
          )}
        </div>
      )}

      {disputing && (
        <form action={disputeRemittance} className="mt-4">
          <input type="hidden" name="remittanceId" value={s.id} />
          <label
            htmlFor={`dispute-${s.id}`}
            className="text-xs uppercase tracking-wider text-ink-muted"
          >
            What looks wrong
          </label>
          <textarea
            id={`dispute-${s.id}`}
            name="disputeNote"
            rows={3}
            required
            minLength={10}
            placeholder="The weight on my attribution doesn't match what I delivered, or the rate is off, or the $BUILD is missing."
            className="mt-1.5 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3 text-sm"
          />
          <div className="mt-3 flex gap-3">
            <Button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#E53E3E" }}
            >
              Send to the admins on this deal
            </Button>
            <Button
              type="button"
              onClick={() => setDisputing(false)}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
