/**
 * /admin/clients — client-dissatisfaction pattern surface.
 *
 * Aggregates rebates + low ratings + disputes per external client
 * (keyed by customerEmail from customer_feedback). Flagged clients
 * surface first so admin can spot counterparty patterns instead of
 * treating every event as isolated.
 *
 * The flag is a signal, not a verdict. Thresholds live in
 * `client-patterns.ts` and can be tuned; admin decides what to do
 * with a flagged client (pause engagements, adjust CX approach,
 * decline future work).
 *
 * Gated to admin.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  computeClientPatterns,
  projectTitlesForClient,
  type ClientPatternSummary,
} from "@/lib/client-patterns";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function AdminClientsPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/clients");

  const patterns = computeClientPatterns();
  const flaggedCount = patterns.filter((p) => p.flagged).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Client patterns</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Counterparty patterns
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Client-side pattern surface. Aggregates rebates, low
            ratings, and disputes per external client so anomalies
            surface as patterns instead of one-off events. Flag is a
            signal, not a verdict — admin decides what to do.
          </p>
        </div>
        <div className="text-right text-xs text-ink-faint">
          <p>
            <span className="font-mono text-sm text-ink">
              {patterns.length}
            </span>{" "}
            client{patterns.length === 1 ? "" : "s"} on file
          </p>
          {flaggedCount > 0 && (
            <p className="text-brand-magenta">
              <span className="font-mono text-sm">{flaggedCount}</span>{" "}
              flagged
            </p>
          )}
        </div>
      </div>

      <section className="mt-10 space-y-4">
        {patterns.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              No customer feedback on file yet — patterns will appear
              here as engagements close and clients rate them.
            </p>
          </Card>
        ) : (
          patterns.map((p) => <ClientPatternCard key={p.customerEmail} p={p} />)
        )}
      </section>

      <Card className="mt-10 border-[var(--surface-border)]">
        <CardEyebrow>Thresholds</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Flag fires when any of the following hits within a rolling
          12-month window:
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
          <li>3+ client rebates issued from a project&apos;s reserve pool</li>
          <li>
            3+ disputes on admin-captured feedback (client rejected the
            captured rating)
          </li>
          <li>4+ low ratings (overall ≤ 3 / 5) across engagements</li>
        </ul>
        <p className="mt-3 text-[11px] text-ink-faint">
          Tune in <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">src/lib/client-patterns.ts</code>.
        </p>
      </Card>
    </div>
  );
}

function ClientPatternCard({ p }: { p: ClientPatternSummary }) {
  const projects = projectTitlesForClient(p.projectIds);
  return (
    <Card
      className={p.flagged ? "border-brand-magenta/40" : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardTitle className="text-lg">{p.customerName}</CardTitle>
          <p className="text-[11px] text-ink-faint">
            {p.customerEmail} · {p.totalFeedback} rating
            {p.totalFeedback === 1 ? "" : "s"} across {projects.length}{" "}
            engagement{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        {p.flagged && (
          <span className="rounded-full bg-brand-magenta/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-brand-magenta">
            Flagged for review
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PatternStat
          label="Rebates (rolling 12mo)"
          rolling={p.rebatesRolling}
          allTime={p.rebatesAllTime}
          suffix={p.rebatesAllTime > 0 ? USD_FMT.format(p.rebateTotalUsd) : null}
        />
        <PatternStat
          label="Disputes (rolling 12mo)"
          rolling={p.disputesRolling}
          allTime={p.disputesAllTime}
        />
        <PatternStat
          label="Low ratings (rolling 12mo)"
          rolling={p.lowRatingsRolling}
          allTime={p.lowRatingsAllTime}
        />
      </div>

      {p.flagReasons.length > 0 && (
        <div className="mt-4 rounded-md border border-brand-magenta/30 bg-brand-magenta/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
            Why flagged
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-ink-muted">
            {p.flagReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {projects.length > 0 && (
        <details className="mt-3 rounded-md border border-[var(--surface-border)] px-3 py-2">
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-ink-muted">
            Engagements ({projects.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[11px]">
            {projects.map((pr) => (
              <li key={pr.id}>
                <Link
                  href={`/admin/contracts/${pr.id}/settle`}
                  className="text-brand-magenta hover:underline"
                >
                  {pr.title}
                </Link>{" "}
                <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5 text-[10px] text-ink-faint">
                  {pr.id}
                </code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function PatternStat({
  label,
  rolling,
  allTime,
  suffix,
}: {
  label: string;
  rolling: number;
  allTime: number;
  suffix?: string | null;
}) {
  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold">
        {rolling}
        <span className="ml-1 text-xs font-normal text-ink-faint">
          / {allTime} all-time
        </span>
      </p>
      {suffix && (
        <p className="mt-0.5 text-[11px] text-ink-faint">{suffix}</p>
      )}
    </div>
  );
}
