/**
 * Admin queue for member applications to public job postings
 * (task #42).
 *
 * Job applications land here after talent hits Submit on /jobs/[id]
 * via the ApplyToJobForm surface. Admin reviews each row, adds an
 * optional note, and approves or rejects — decision fires a
 * notification back to the applicant.
 *
 * Parallel to /admin/projects/applications (contract bids). Kept
 * separate because jobs and projects are separate concepts — jobs
 * carry compensation + employmentType, projects carry budget + RFP
 * flag. Same shape of admin surface either way.
 *
 * Reads job_applications via Drizzle (real table, not mock). Server
 * action reviewJobApplication lives in src/lib/application-actions.ts.
 */
import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { jobApplications, jobs, users } from "@/db/schema";
import { reviewJobApplication } from "@/lib/application-actions";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { adminName, publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

type ApplicationRow = typeof jobApplications.$inferSelect;

const STATUS_ACCENT: Record<string, string> = {
  pending: "#5070F0",
  approved: "#007048",
  rejected: "#D828A0",
  withdrawn: "#666666",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminJobsApplicationsPage() {
  await requireAdmin();

  // Freshest first. Full page instead of paginating — job apps
  // volume is low at MVP. Paginate when it grows past ~200.
  const rows = await db
    .select()
    .from(jobApplications)
    .orderBy(desc(jobApplications.createdAt))
    .limit(200);

  // Preload the jobs + users referenced so we don't hit the DB
  // per-row inside the map. Union of both id sets → one query each.
  const jobIds = Array.from(new Set(rows.map((r) => r.jobId)));
  const userIds = Array.from(
    new Set([
      ...rows.map((r) => r.userId),
      ...rows.map((r) => r.reviewedBy).filter((v): v is string => !!v),
    ]),
  );
  const [jobRows, userRows] = await Promise.all([
    jobIds.length
      ? db.select().from(jobs).where(inArray(jobs.id, jobIds))
      : Promise.resolve([]),
    userIds.length
      ? db.select().from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
  ]);
  // Small in-flight join — union with MOCK_USERS as fallback for seed
  // users that haven't been backfilled into Postgres yet.
  const jobById = new Map(jobRows.map((j) => [j.id, j]));
  const userById = new Map([
    ...userRows.map((u) => [u.id, u] as const),
    ...MOCK_USERS.map((u) => [u.id, u] as const),
  ]);

  function jobTitleFor(id: string): string {
    return jobById.get(id)?.title ?? id;
  }
  function nameFor(id: string | null): string {
    if (!id) return "—";
    const u = userById.get(id);
    if (!u) return id;
    // Real Postgres users may only have `name`; MOCK_USERS have firstName/lastName.
    // publicName + adminName handle both shapes via the User type.
    const hasFmShape = typeof (u as { firstName?: unknown }).firstName !== "undefined";
    return hasFmShape
      ? adminName(u as Parameters<typeof adminName>[0])
      : ((u as { name?: string; email?: string }).name ??
        (u as { email?: string }).email ??
        id);
  }
  function firstNameFor(id: string): string {
    const u = userById.get(id);
    if (!u) return id;
    const hasFmShape = typeof (u as { firstName?: unknown }).firstName !== "undefined";
    return hasFmShape
      ? publicName(u as Parameters<typeof publicName>[0])
      : ((u as { name?: string }).name?.split(" ")[0] ?? id);
  }

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Jobs</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Job application queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Talent applying to open roles on{" "}
            <Link href="/jobs" className="text-brand-magenta hover:underline">
              /jobs
            </Link>
            . Approve routes them to the client + fires an inbox ping;
            reject sends a softer "not this round" note.
          </p>
        </div>
        <Link
          href="/admin/inbound"
          className="text-xs text-brand-magenta hover:underline"
        >
          ← Unified inbound
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            All caught up. New applications land at the top when talent
            hits Apply on a public job listing.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {pending.map((row) => (
              <ApplicationCard
                key={row.id}
                row={row}
                jobTitle={jobTitleFor(row.jobId)}
                applicantName={firstNameFor(row.userId)}
              />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">
            Decided ({decided.length})
          </h2>
          <div className="mt-3 space-y-3">
            {decided.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-medium">
                      {firstNameFor(row.userId)}
                    </span>{" "}
                    · {jobTitleFor(row.jobId)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${STATUS_ACCENT[row.status]}22`,
                      color: STATUS_ACCENT[row.status],
                    }}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">
                  Reviewed by {nameFor(row.reviewedBy)} ·{" "}
                  {formatDate(row.reviewedAt)}
                </div>
                {row.adminNote && (
                  <p className="mt-1 text-xs text-ink-muted">
                    Note: {row.adminNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ApplicationCard({
  row,
  jobTitle,
  applicantName,
}: {
  row: ApplicationRow;
  jobTitle: string;
  applicantName: string;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle className="text-lg">
          {applicantName} · {jobTitle}
        </CardTitle>
        <span className="text-[11px] text-ink-faint">
          Submitted {new Date(row.createdAt).toLocaleDateString()}
        </span>
      </div>

      {(row.desiredCompensation || row.portfolioLink) && (
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-ink-muted">
          {row.desiredCompensation && (
            <span>
              <span className="text-ink-faint">Desired comp:</span>{" "}
              {row.desiredCompensation}
            </span>
          )}
          {row.portfolioLink && (
            <a
              href={row.portfolioLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-magenta hover:underline"
            >
              Portfolio ↗
            </a>
          )}
        </div>
      )}

      <p className="mt-3 whitespace-pre-wrap text-sm text-ink">
        {row.pitch}
      </p>

      <form action={reviewJobApplication} className="mt-4 space-y-2">
        <input type="hidden" name="id" value={row.id} />
        <input
          name="adminNote"
          placeholder="Note to applicant (optional — shows in their notification)"
          className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            name="decision"
            value="approved"
            className="rounded-full bg-[#007048] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90"
          >
            Approve → route to client
          </button>
          <button
            type="submit"
            name="decision"
            value="rejected"
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] hover:border-[#d84343] hover:text-[#d84343]"
          >
            Reject
          </button>
        </div>
      </form>
    </Card>
  );
}
