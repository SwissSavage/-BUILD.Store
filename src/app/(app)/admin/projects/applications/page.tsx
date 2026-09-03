/**
 * Admin queue for member applications to internal projects.
 *
 * Each pending row gets approve/reject controls + an admin-note field.
 * Approving auto-adds the applicant to `Project.assignedMemberIds` and
 * fires a "you're on" notification; rejecting fires a softer "not this
 * round" notification. Either path leaves the row visible in the
 * "Decided" lane below for audit.
 *
 * REPLACE WITH: a Drizzle query joining `project_applications` +
 * `users` + `projects`. Server actions stay the same shape.
 */
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllApplications } from "@/lib/readers/project-applications";
import { getAllUsers } from "@/lib/readers/users";
import { getAllProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { decideProjectApplication } from "@/lib/project-application-actions";
import {
  withdrawProposalAsAdmin,
  restoreProposalAsAdmin,
} from "@/lib/project-edit-actions";
import {
  PROJECT_APPLICATION_STATUS_LABELS,
  TIER_LABELS,
  adminName,
  type ProjectApplication,
  type Project,
  type User,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const STATUS_ACCENT: Record<ProjectApplication["status"], string> = {
  pending: "#5070F0",
  approved: "#007048",
  rejected: "#D828A0",
  withdrawn: "#666666",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const dynamic = "force-dynamic";

export default async function AdminProjectApplicationsPage() {
  await requireAdmin();

  // Reader swap 2026-08-29: bid triage queue read a mock array, so a
  // real member's application never appeared for review.
  const [applications, { users: roster }, { projects }] = await Promise.all([
    safely(() => getAllApplications(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    safely(() => getAllProjects(), {
      projects: [],
      source: "postgres" as const,
    }),
  ]);
  const lookup = makeLookup(roster, projects);

  const sorted = [...applications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const pending = sorted.filter((a) => a.status === "pending");
  const decided = sorted.filter((a) => a.status !== "pending");

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Projects</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Proposals
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Contractors who have proposed themselves for this work. Build
            the team from who is available — selecting adds them to the
            roster for the engagement and pings their inbox. Passing on
            someone here is about fit for this piece, not a judgment on
            them.
          </p>
        </div>
        <Link
          href="/admin/projects"
          className="text-xs text-brand-magentaText hover:underline"
        >
          ← All projects
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">All caught up.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.map((a) => (
              <PendingRow key={a.id} application={a} lookup={lookup} />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">
            Decided ({decided.length})
          </h2>
          <div className="mt-3 space-y-2">
            {decided.map((a) => (
              <DecidedRow
                key={a.id}
                application={a}
                lookup={lookup}
                roster={roster}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Build a row-lookup closure over the already-loaded roster and
 * project list. Each row would otherwise cost two queries.
 */
type RowLookup = (application: ProjectApplication) => {
  applicant: User | undefined;
  project: Project | undefined;
};

function makeLookup(roster: User[], projects: Project[]): RowLookup {
  const userById = new Map(roster.map((u) => [u.id, u]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  return (application) => ({
    applicant: userById.get(application.userId),
    project: projectById.get(application.projectId),
  });
}

function PendingRow({
  application,
  lookup,
}: {
  application: ProjectApplication;
  lookup: RowLookup;
}) {
  const { applicant, project } = lookup(application);

  return (
    <Card className="border-[#5070F0]/40">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardTitle>
            {applicant ? adminName(applicant) : "Unknown member"}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            {applicant ? TIER_LABELS[applicant.membershipTier] : ""} ·{" "}
            {application.hoursPerWeek}h/wk · submitted{" "}
            {formatDate(application.createdAt)}
          </p>
        </div>
        <Link
          href={project ? `/projects/${project.id}` : "/projects"}
          className="text-xs text-brand-magentaText hover:underline"
        >
          {project ? project.title : "Project missing"} →
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-muted">
            Proposed role
          </p>
          <p className="mt-1 font-medium">{application.proposedRole}</p>

          <p className="mt-4 text-xs uppercase tracking-wider text-ink-muted">
            Pitch
          </p>
          <p className="mt-1 text-sm italic text-ink-muted">
            "{application.pitch}"
          </p>

          {(application.attachments ?? []).length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-ink-faint">
                Portfolio documents
              </p>
              <ul className="mt-2 space-y-1">
                {(application.attachments ?? []).map((doc, i) => (
                  <li key={i}>
                    <a
                      href={`/api/proposals/${application.id}/attachments/${i}`}
                      className="text-sm text-brand-magentaText hover:underline"
                    >
                      {doc.name}
                    </a>{" "}
                    <span className="text-xs text-ink-faint">
                      {(doc.sizeBytes / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {application.portfolioLink && (
            <p className="mt-3 text-xs">
              <span className="text-ink-muted">Reference: </span>
              <a
                href={application.portfolioLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-magentaText hover:underline"
              >
                {application.portfolioLink}
              </a>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4 text-xs">
          <p className="text-ink-muted">Member skills on file:</p>
          <p className="mt-1 text-ink">
            {applicant?.skills?.join(", ") || "—"}
          </p>
          {applicant?.bio && (
            <p className="mt-3 italic text-ink-muted">"{applicant.bio}"</p>
          )}
        </div>
      </div>

      <form
        action={decideProjectApplication}
        className="mt-5 space-y-3 border-t border-[var(--surface-border)] pt-4"
      >
        <input type="hidden" name="id" value={application.id} />
        <label
          htmlFor={`note-${application.id}`}
          className="block text-xs uppercase tracking-wider text-ink-muted"
        >
          Admin note (sent in the inbox notification)
        </label>
        <textarea
          id={`note-${application.id}`}
          name="adminNote"
          rows={2}
          placeholder="Optional. Pair them with another contractor, set scope, or note what this round needed instead."
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel="Saving…"
            name="decision"
            value="approve"
            className="rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#007048" }}
          >
            Select for the team
          </SubmitButton>
          <SubmitButton pendingLabel="Saving…"
            name="decision"
            value="reject"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta hover:text-brand-magentaText"
          >
            Not this round
          </SubmitButton>
        </div>
      </form>

      {/* Removing is separate from deciding. "Not this round" is a
          judgement the contractor hears about; this is queue cleanup
          for test data and mistakes, and it is reversible. */}
      <form action={withdrawProposalAsAdmin} className="mt-3">
        <input type="hidden" name="id" value={application.id} />
        <SubmitButton pendingLabel="Saving…"
          className="text-xs text-ink-faint underline hover:text-brand-magentaText"
        >
          Remove from queue
        </SubmitButton>
      </form>
    </Card>
  );
}

function DecidedRow({
  application,
  lookup,
  roster,
}: {
  application: ProjectApplication;
  lookup: RowLookup;
  roster: User[];
}) {
  const { applicant, project } = lookup(application);
  const accent = STATUS_ACCENT[application.status];
  const decidedDate =
    application.reviewedAt ?? application.withdrawnAt ?? application.createdAt;
  const decidedBy = application.reviewedBy
    ? roster.find((u) => u.id === application.reviewedBy)
    : undefined;

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">
            {applicant ? adminName(applicant) : "Unknown member"}
          </span>
          <span className="text-ink-muted">
            {" "}
            · {application.proposedRole}
          </span>
          {project && (
            <Link
              href={`/projects/${project.id}`}
              className="ml-2 text-xs text-brand-magentaText hover:underline"
            >
              {project.title} →
            </Link>
          )}
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
          style={{ backgroundColor: accent + "22", color: accent }}
        >
          {PROJECT_APPLICATION_STATUS_LABELS[application.status]}
          {application.status === "withdrawn" && (
            <form action={restoreProposalAsAdmin} className="mt-1">
              <input type="hidden" name="id" value={application.id} />
              <SubmitButton pendingLabel="Saving…"
                className="text-[11px] text-ink-faint underline hover:text-brand-magentaText"
              >
                Put back in the queue
              </SubmitButton>
            </form>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Decided {formatDate(decidedDate)}
        {decidedBy ? ` by ${adminName(decidedBy)}` : ""}
      </p>
      {application.adminNote && (
        <p className="mt-2 text-xs italic" style={{ color: accent }}>
          "{application.adminNote}"
        </p>
      )}
    </div>
  );
}
