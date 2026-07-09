/**
 * Admin: unified inbound submissions hub.
 *
 * One queue across every public-facing form and surface:
 *   - Signup intents (hire / build-team / join)
 *   - RFP intake
 *   - Custom quote requests
 *   - Live chat inquiries
 *   - Partner applications
 *   - Store inquiries
 *
 * Triage state lives on each row. Status, assignment, and triage notes
 * are admin-editable inline. The "Suggested talent" column runs the
 * semantic match scorer against the submission's keyword tags so
 * admins see who in the cooperative is likely the right fit even when
 * the submitter's vocabulary doesn't match canonical skill tags.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { listInboundSubmissions } from "@/lib/mock-data/inbound-submissions";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { scoreTalentMatch } from "@/lib/talent-match";
import {
  setInboundStatus,
  assignInbound,
  unassignInbound,
  setInboundTriageNote,
  appendInboundKeywordTags,
} from "@/lib/inbound-submission-actions";
import {
  approveBookingRequest,
  declineBookingRequest,
} from "@/lib/epk-booking-actions";
import {
  INBOUND_SUBMISSION_KIND_LABELS,
  INBOUND_SUBMISSION_STATUS_LABELS,
  INDUSTRY_LABELS,
  publicName,
  type InboundSubmission,
  type InboundSubmissionKind,
  type InboundSubmissionStatus,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const KIND_OPTIONS: InboundSubmissionKind[] = [
  "hire_talent_signup",
  "build_team_signup",
  "join_talent_signup",
  "rfp_intake",
  "custom_quote_request",
  "partner_application",
  "chat_inquiry",
  "store_inquiry",
  "other",
];

const STATUS_OPTIONS: InboundSubmissionStatus[] = [
  "new",
  "in_triage",
  "needs_info",
  "converted",
  "closed_no_action",
];

export default async function AdminInboundPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    status?: string;
    assignee?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const kind = isKind(sp.kind) ? sp.kind : undefined;
  const status = isStatus(sp.status) ? sp.status : undefined;
  const assignee = sp.assignee ? sp.assignee : undefined;

  const rows = listInboundSubmissions({
    kind,
    status,
    assignedAdminId: assignee,
  });
  const admins = MOCK_USERS.filter((u) => u.isAdmin);

  // Top-of-page counts.
  const allRows = listInboundSubmissions();
  const counts: Record<InboundSubmissionStatus, number> = {
    new: 0,
    in_triage: 0,
    needs_info: 0,
    converted: 0,
    closed_no_action: 0,
  };
  for (const r of allRows) counts[r.status]++;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm text-ink-muted hover:text-ink"
          >
            ← Admin home
          </Link>
          <h1 className="mt-3 font-display text-4xl font-semibold">
            Inbound
          </h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Every form submission, chat inquiry, RFP, and partner ping
            lands here first. Triage in one queue, drill into the typed
            admin surface, route to the right contributor.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-5">
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={`/admin/inbound?status=${s}`}
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 transition-colors hover:border-brand-magenta"
          >
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">
              {INBOUND_SUBMISSION_STATUS_LABELS[s]}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {counts[s]}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3 text-xs">
        <FilterChip
          label="All kinds"
          href="/admin/inbound"
          active={!kind}
        />
        {KIND_OPTIONS.map((k) => (
          <FilterChip
            key={k}
            label={INBOUND_SUBMISSION_KIND_LABELS[k]}
            href={`/admin/inbound?kind=${k}`}
            active={kind === k}
          />
        ))}
      </div>

      <section className="mt-8 space-y-4">
        {rows.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              Nothing in this view. Try a different filter.
            </p>
          </Card>
        ) : (
          rows.map((row) => (
            <SubmissionRow key={row.id} row={row} admins={admins} />
          ))
        )}
      </section>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 transition-colors ${
        active
          ? "border-brand-magenta bg-brand-magenta text-white"
          : "border-[var(--surface-border)] hover:border-brand-magenta hover:text-brand-magenta"
      }`}
    >
      {label}
    </Link>
  );
}

function SubmissionRow({
  row,
  admins,
}: {
  row: InboundSubmission;
  admins: typeof MOCK_USERS;
}) {
  const matches = scoreTalentMatch(
    { pillars: row.pillarTags, keywordTags: row.keywordTags },
    4,
  );
  const assignee = admins.find((a) => a.id === row.assignedAdminId);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardEyebrow>{INBOUND_SUBMISSION_KIND_LABELS[row.kind]}</CardEyebrow>
          <CardTitle className="mt-1 text-xl">{row.title}</CardTitle>
          <p className="mt-1 text-xs text-ink-faint">
            From {row.submitter}
            {row.submitterEmail && <> &middot; {row.submitterEmail}</>}
            {row.submitterCompany && <> &middot; {row.submitterCompany}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider"
            style={{
              backgroundColor: STATUS_BG[row.status],
              color: STATUS_FG[row.status],
            }}
          >
            {INBOUND_SUBMISSION_STATUS_LABELS[row.status]}
          </span>
          {row.derived && (
            <span className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[10px] uppercase tracking-wider text-ink-faint">
              Derived
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm text-ink">{row.body}</p>

      {(row.pillarTags.length > 0 || row.keywordTags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {row.pillarTags.map((p) => (
            <span
              key={p}
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: "rgba(80, 112, 240, 0.12)", color: "#5070F0" }}
            >
              {INDUSTRY_LABELS[p]}
            </span>
          ))}
          {row.keywordTags.slice(0, 12).map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: "rgba(216, 40, 160, 0.10)", color: "#D828A0" }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {row.attachments.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Attachments:{" "}
          {row.attachments
            .map((a) => `${a.name} (${Math.round(a.size / 1024)}kb)`)
            .join(", ")}
        </p>
      )}

      {/* Booking-request-specific approval controls. Only shows when
          the row is a booking_request AND still in a decidable state.
          Approve confirms the FM agent's side of the linked meeting +
          moves the submission to converted; the attendee (artist) then
          confirms from their own /profile/calendar. Decline cancels
          the tentative meeting + closes the submission. */}
      {row.kind === "booking_request" &&
        (row.status === "new" || row.status === "in_triage") && (
          <div
            className="mt-4 rounded-lg border-l-4 p-3 text-xs"
            style={{
              borderColor: "#5070F0",
              backgroundColor: "rgba(80, 112, 240, 0.06)",
            }}
          >
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "#5070F0" }}
            >
              EPK booking · approve or decline
            </span>
            <p className="mt-1 text-ink-muted">
              A tentative meeting is on the FM agent&apos;s calendar
              waiting on your decision. Approve routes it forward for
              the artist to confirm; decline cancels the meeting +
              closes this row.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={approveBookingRequest}>
                <input type="hidden" name="submissionId" value={row.id} />
                <button
                  type="submit"
                  className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
                  style={{ backgroundColor: "#007048" }}
                >
                  Approve → route to attendee
                </button>
              </form>
              <form
                action={declineBookingRequest}
                className="flex flex-wrap items-end gap-1"
              >
                <input type="hidden" name="submissionId" value={row.id} />
                <input
                  name="reason"
                  type="text"
                  placeholder="Reason (optional)"
                  className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                />
                <button
                  type="submit"
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
                >
                  Decline
                </button>
              </form>
            </div>
          </div>
        )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--surface-border)] p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">
            Triage
          </div>
          {!row.derived ? (
            <>
              <form
                action={setInboundStatus}
                className="mt-2 flex flex-wrap items-end gap-2 text-xs"
              >
                <input type="hidden" name="id" value={row.id} />
                <label className="flex flex-col">
                  Status
                  <select
                    name="status"
                    defaultValue={row.status}
                    className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {INBOUND_SUBMISSION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-ink px-3 py-1 text-[11px] font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
                >
                  Update
                </button>
              </form>

              <form
                action={assignInbound}
                className="mt-3 flex flex-wrap items-end gap-2 text-xs"
              >
                <input type="hidden" name="id" value={row.id} />
                <label className="flex flex-col">
                  Assignee
                  <select
                    name="assigneeUserId"
                    defaultValue={row.assignedAdminId ?? ""}
                    className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1"
                  >
                    <option value="">(claim for myself)</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {publicName(a)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
                >
                  Assign
                </button>
              </form>

              {row.assignedAdminId && (
                <form action={unassignInbound} className="mt-2">
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-brand-magenta underline hover:opacity-80"
                  >
                    Unassign {assignee ? publicName(assignee) : ""}
                  </button>
                </form>
              )}

              <form action={setInboundTriageNote} className="mt-3 text-xs">
                <input type="hidden" name="id" value={row.id} />
                <label className="block">
                  Note (admin-only)
                  <textarea
                    name="triageNote"
                    defaultValue={row.triageNote ?? ""}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-2 rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
                >
                  Save note
                </button>
              </form>

              <form action={appendInboundKeywordTags} className="mt-3 text-xs">
                <input type="hidden" name="id" value={row.id} />
                <label className="block">
                  Add tags (comma-separated)
                  <input
                    name="tags"
                    placeholder="dtc, shopify, retrofit"
                    className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-2 rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
                >
                  Append tags
                </button>
              </form>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              This row is projected from the canonical store for{" "}
              {row.kind === "rfp_intake"
                ? "RFP intake"
                : row.kind === "chat_inquiry"
                  ? "live chat"
                  : row.kind === "join_talent_signup"
                    ? "tier applications"
                    : "quotes"}
              . Triage in the deep view.
            </p>
          )}

          {row.deepLinkHref && (
            <Link
              href={row.deepLinkHref}
              className="mt-3 inline-block text-[11px] text-brand-magenta underline hover:opacity-80"
            >
              Open in {row.deepLinkHref.replace("/admin/", "")} ↗
            </Link>
          )}
        </div>

        <div className="rounded-lg border border-[var(--surface-border)] p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">
            Suggested talent (semantic match)
          </div>
          {matches.length === 0 ? (
            <p className="mt-2 text-xs text-ink-muted">
              No members matched. Add a pillar tag or a few keyword tags
              so the scorer has something to work with.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {matches.map((m) => (
                <li key={m.user.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link
                      href={`/u/${m.user.handle}`}
                      className="font-medium hover:underline"
                    >
                      {publicName(m.user)}
                    </Link>
                    {m.user.discipline && (
                      <span className="ml-2 text-[11px] text-ink-muted">
                        {m.user.discipline}
                      </span>
                    )}
                    {m.matchedTags.length > 0 && (
                      <div className="mt-1 text-[11px] text-ink-faint">
                        Matched: {m.matchedTags.slice(0, 5).join(", ")}
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] text-ink-faint">
                      Fit {(m.fitScore * 100).toFixed(0)}% · MVP ×
                      {m.mvpFactor.toFixed(2)}
                      {m.ovr !== null && ` (OVR ${m.ovr})`}
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium">
                    {(m.score * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-ink-faint">
        Last update {new Date(row.updatedAt).toLocaleString()}
        {assignee && ` · Assigned to ${publicName(assignee)}`}
      </p>
    </Card>
  );
}

const STATUS_BG: Record<InboundSubmissionStatus, string> = {
  new: "rgba(80, 112, 240, 0.12)",
  in_triage: "rgba(216, 40, 160, 0.12)",
  needs_info: "rgba(255, 165, 0, 0.15)",
  converted: "rgba(0, 112, 72, 0.12)",
  closed_no_action: "rgba(102, 102, 102, 0.12)",
};

const STATUS_FG: Record<InboundSubmissionStatus, string> = {
  new: "#5070F0",
  in_triage: "#D828A0",
  needs_info: "#B86E00",
  converted: "#007048",
  closed_no_action: "#666666",
};

function isKind(v: string | undefined): v is InboundSubmissionKind {
  return !!v && (KIND_OPTIONS as string[]).includes(v);
}
function isStatus(v: string | undefined): v is InboundSubmissionStatus {
  return !!v && (STATUS_OPTIONS as string[]).includes(v);
}
