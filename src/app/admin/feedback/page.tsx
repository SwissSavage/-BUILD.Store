/**
 * Admin: beta feedback triage.
 *
 * Slice-and-dice over MOCK_FEEDBACK by:
 *   - sentiment (positive / confused / blocker)
 *   - status (new / triaged / resolved)
 *   - surface (the URL they were on)
 *   - tier + pillar (denormalized at submit time)
 *
 * Each row exposes a triage form: status select + admin reply note.
 * The form posts to `triageFeedback`. Sandbox state lives in memory
 * — this is the surface a real admin will use to keep the beta from
 * piling up unread feedback.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_FEEDBACK } from "@/lib/mock-data/feedback";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { triageFeedback } from "@/lib/walkthrough-actions";
import {
  FEEDBACK_SENTIMENT_LABELS,
  FEEDBACK_STATUS_LABELS,
  INDUSTRY_LABELS,
  TIER_LABELS,
  adminName,
  type FeedbackSentiment,
  type FeedbackStatus,
  type Industry,
  type MembershipTier,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";

type SearchParams = {
  sentiment?: string;
  status?: string;
  surface?: string;
  tier?: string;
  pillar?: string;
};

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const sentimentFilter = parseEnum(params.sentiment, [
    "positive",
    "confused",
    "blocker",
  ]) as FeedbackSentiment | null;
  const statusFilter = parseEnum(params.status, [
    "new",
    "triaged",
    "resolved",
  ]) as FeedbackStatus | null;
  const tierFilter = parseEnum(params.tier, [
    "viewer",
    "prospect",
    "partner",
    "member",
  ]) as MembershipTier | null;
  const pillarFilter = parseEnum(params.pillar, [
    "stem",
    "creative-media",
    "professional-services",
  ]) as Industry | null;
  const surfaceFilter = params.surface?.trim() || null;

  // Newest first.
  const filtered = [...MOCK_FEEDBACK]
    .filter((f) => !sentimentFilter || f.sentiment === sentimentFilter)
    .filter((f) => !statusFilter || f.status === statusFilter)
    .filter((f) => !surfaceFilter || f.surface === surfaceFilter)
    .filter((f) => !tierFilter || f.tier === tierFilter)
    .filter((f) => !pillarFilter || f.pillar === pillarFilter)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const totalNew = MOCK_FEEDBACK.filter((f) => f.status === "new").length;
  const totalBlockers = MOCK_FEEDBACK.filter(
    (f) => f.sentiment === "blocker" && f.status !== "resolved",
  ).length;

  // Surface options derived from data so the dropdown stays in sync.
  const surfaceOptions = Array.from(
    new Map(
      MOCK_FEEDBACK.map((f) => [f.surface, f.surfaceLabel] as const),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Beta operations</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Feedback triage
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {MOCK_FEEDBACK.length} total entries · {totalNew} untriaged ·{" "}
            <span className="text-brand-magenta">{totalBlockers} open blockers</span>
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          ← Admin home
        </Link>
      </div>

      <FilterBar
        params={params}
        surfaceOptions={surfaceOptions}
        sentimentFilter={sentimentFilter}
        statusFilter={statusFilter}
        tierFilter={tierFilter}
        pillarFilter={pillarFilter}
      />

      <div className="mt-8 space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <CardTitle>No entries match those filters.</CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Try clearing one of them, or browse all{" "}
              <Link href="/admin/feedback" className="underline">
                feedback
              </Link>
              .
            </p>
          </Card>
        ) : (
          filtered.map((entry) => {
            const submitter = MOCK_USERS.find((u) => u.id === entry.userId);
            return (
              <Card key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SentimentChip sentiment={entry.sentiment} />
                      <StatusChip status={entry.status} />
                      <span className="text-xs text-ink-muted">
                        {entry.surfaceLabel}
                      </span>
                      <span className="text-xs text-ink-faint">
                        ·{" "}
                        {new Date(entry.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <p className="mt-3 text-sm">{entry.note}</p>
                    <p className="mt-3 text-xs text-ink-muted">
                      {submitter ? adminName(submitter) : entry.userId} ·{" "}
                      <TierBadge tier={entry.tier} />{" "}
                      {entry.pillar && (
                        <span className="ml-1">
                          · {INDUSTRY_LABELS[entry.pillar]}
                        </span>
                      )}
                      {entry.walkthroughStepId && (
                        <span className="ml-1 text-ink-faint">
                          · from walkthrough step
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={entry.surface}
                    className="text-xs text-ink-muted underline hover:text-ink"
                  >
                    Open surface ↗
                  </Link>
                </div>

                {entry.adminNote && (
                  <div className="mt-4 rounded-xl bg-[var(--surface-inset)] p-3 text-xs">
                    <span className="font-medium">Admin reply:</span>{" "}
                    <span className="text-ink-muted">{entry.adminNote}</span>
                    {entry.triagedBy && (
                      <span className="ml-2 text-ink-faint">
                        — {adminName(
                          MOCK_USERS.find((u) => u.id === entry.triagedBy) ??
                            null,
                        )}
                      </span>
                    )}
                  </div>
                )}

                <form action={triageFeedback} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={entry.id} />
                  <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                    Status
                    <select
                      name="status"
                      defaultValue={entry.status}
                      className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-sm normal-case tracking-normal text-ink"
                    >
                      <option value="new">New</option>
                      <option value="triaged">Triaged</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  <label className="flex flex-1 flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                    Admin note
                    <input
                      type="text"
                      name="adminNote"
                      defaultValue={entry.adminNote ?? ""}
                      placeholder="What's the disposition?"
                      className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1 text-sm normal-case tracking-normal text-ink placeholder:text-ink-faint"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
                  >
                    Save
                  </button>
                </form>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterBar({
  params,
  surfaceOptions,
  sentimentFilter,
  statusFilter,
  tierFilter,
  pillarFilter,
}: {
  params: SearchParams;
  surfaceOptions: Array<readonly [string, string]>;
  sentimentFilter: FeedbackSentiment | null;
  statusFilter: FeedbackStatus | null;
  tierFilter: MembershipTier | null;
  pillarFilter: Industry | null;
}) {
  const anyFilter =
    !!sentimentFilter || !!statusFilter || !!tierFilter || !!pillarFilter || !!params.surface;
  return (
    // Native GET form — submitting writes the filter values to the URL,
    // which the page reads on the next render. No client JS required.
    <form className="mt-6 grid gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 md:grid-cols-5">
      <Filter
        name="status"
        label="Status"
        defaultValue={params.status ?? ""}
        options={[
          ["", "All"],
          ["new", FEEDBACK_STATUS_LABELS.new],
          ["triaged", FEEDBACK_STATUS_LABELS.triaged],
          ["resolved", FEEDBACK_STATUS_LABELS.resolved],
        ]}
      />
      <Filter
        name="sentiment"
        label="Sentiment"
        defaultValue={params.sentiment ?? ""}
        options={[
          ["", "All"],
          ["positive", FEEDBACK_SENTIMENT_LABELS.positive],
          ["confused", FEEDBACK_SENTIMENT_LABELS.confused],
          ["blocker", FEEDBACK_SENTIMENT_LABELS.blocker],
        ]}
      />
      <Filter
        name="tier"
        label="Tier"
        defaultValue={params.tier ?? ""}
        options={[
          ["", "All"],
          ["prospect", TIER_LABELS.prospect],
          ["partner", TIER_LABELS.partner],
          ["member", TIER_LABELS.member],
        ]}
      />
      <Filter
        name="pillar"
        label="Pillar"
        defaultValue={params.pillar ?? ""}
        options={[
          ["", "All"],
          ["stem", INDUSTRY_LABELS.stem],
          ["creative-media", INDUSTRY_LABELS["creative-media"]],
          ["professional-services", INDUSTRY_LABELS["professional-services"]],
        ]}
      />
      <Filter
        name="surface"
        label="Surface"
        defaultValue={params.surface ?? ""}
        options={[["", "All"], ...surfaceOptions]}
      />
      <div className="flex items-center gap-2 md:col-span-5">
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
        >
          Apply filters
        </button>
        {anyFilter && (
          <Link
            href="/admin/feedback"
            className="text-xs text-ink-muted underline hover:text-ink"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}

function Filter({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<readonly [string, string]>;
}) {
  return (
    <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-sm normal-case tracking-normal text-ink"
      >
        {options.map(([v, l]) => (
          <option key={v || "_all"} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function SentimentChip({ sentiment }: { sentiment: FeedbackSentiment }) {
  const styles: Record<FeedbackSentiment, { bg: string; fg: string }> = {
    positive: { bg: "rgba(0, 112, 72, 0.15)", fg: "#007048" },
    confused: { bg: "rgba(80, 112, 240, 0.15)", fg: "#5070F0" },
    blocker: { bg: "rgba(216, 40, 160, 0.15)", fg: "#D828A0" },
  };
  const s = styles[sentiment];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {FEEDBACK_SENTIMENT_LABELS[sentiment]}
    </span>
  );
}

function StatusChip({ status }: { status: FeedbackStatus }) {
  return (
    <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
      {FEEDBACK_STATUS_LABELS[status]}
    </span>
  );
}

function parseEnum<T extends string>(
  raw: string | undefined,
  allowed: T[],
): T | null {
  if (!raw) return null;
  return (allowed as string[]).includes(raw) ? (raw as T) : null;
}
