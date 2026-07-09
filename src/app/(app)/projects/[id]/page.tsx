/**
 * Project detail (Phase 2.5 sandbox, public-extended Phase 2.8).
 *
 * Three distinct lanes meet on this page:
 *
 *   - Internal projects (kind="internal") → members can pitch themselves
 *     via an inline apply form. Admins approve/reject in
 *     /admin/projects/applications. Approval auto-adds the user to
 *     `assignedMemberIds`.
 *   - Internal projects, viewed by an UNAUTHENTICATED person → read-only
 *     overview + an "Offer to help" form that writes a
 *     ProspectiveContribution row. Admin triages those in
 *     /admin/projects/contributions and follows up by email.
 *   - Contract projects (kind="contract") → no apply form here. Bidding
 *     happens through QuoteSheet on /contracts. We just show a read-only
 *     overview with a CTA to the right surface. Logged-out visitors get
 *     bounced to /signin (external work isn't a public surface).
 *
 * Bottom of the page also surfaces the project's existing application
 * lane (so the applicant can see their own status, and an admin can
 * see the full queue without leaving the project).
 *
 * REPLACE WITH: a Drizzle query joining `projects` + `users` for the
 * team list and `project_applications` for the queue. Server action
 * targets stay the same shape.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  applicationsForProject,
  latestApplication,
} from "@/lib/mock-data/project-applications";
import {
  applyToProject,
  withdrawProjectApplication,
} from "@/lib/project-application-actions";
import { submitProspectiveContribution } from "@/lib/prospective-contribution-actions";
import {
  INDUSTRY_LABELS,
  PROJECT_APPLICATION_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  publicName,
  adminName,
  type MilestoneStatus,
  type Project,
  type ProjectApplication,
  type User,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { PeerReviewSection } from "@/components/PeerReviewSection";
import { MilestoneTracker } from "@/components/MilestoneTracker";
import { TalentHand, type TalentHandEntry } from "@/components/TalentHand";
import {
  deriveTradingCardTier,
} from "@/components/TradingCard";
import { mvpScoreForUser, MOCK_MVP_SCORES } from "@/lib/mock-data/mvp-scores";
import { championsCourtMembers } from "@/lib/mvp-score";
import { milestonesForProject } from "@/lib/mock-data/project-milestones";
import { updateMilestoneStatus } from "@/lib/milestone-actions";

const TALENT_MILESTONE_STATUSES: MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
];

const STATUS_ACCENT: Record<ProjectApplication["status"], string> = {
  pending: "#5070F0",
  approved: "#007048",
  rejected: "#D828A0",
  withdrawn: "#666666",
};

function userById(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const isInternal = project.kind === "internal";
  // External contracts are not a public surface — bounce logged-out
  // visitors to sign-in. Internal projects are public for the
  // "offer to help" rail.
  if (!user && !isInternal) {
    redirect(`/signin?next=/projects/${id}`);
  }

  const isAdmin = user?.isAdmin ?? false;
  const onTeam = user
    ? project.assignedMemberIds.includes(user.id)
    : false;
  const acceptingApplicants =
    isInternal &&
    !!user &&
    !onTeam &&
    (project.status === "open" || project.status === "in_progress");
  const acceptingOutsideOffers =
    isInternal &&
    (project.status === "open" || project.status === "in_progress");

  const myLatest = user ? latestApplication(project.id, user.id) : null;
  const myPending = myLatest && myLatest.status === "pending" ? myLatest : null;
  const allApps = applicationsForProject(project.id);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link
        href="/projects"
        className="text-xs uppercase tracking-wider text-ink-muted hover:text-ink"
      >
        ← All projects
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>
            {isInternal ? "Internal initiative" : "External contract"} ·{" "}
            {INDUSTRY_LABELS[project.industry]}
          </CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            {project.title}
          </h1>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
          style={{ backgroundColor: "rgba(80,112,240,0.15)", color: "#5070F0" }}
        >
          {project.status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardTitle>About this work</CardTitle>
            <p className="mt-3 text-sm text-ink-muted whitespace-pre-line">
              {project.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {project.skillsRequired.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          </Card>

          {/* ── Milestone tracker (Domino's-style) ───── */}
          {user && (
            <ProjectMilestonesSection
              project={project}
              user={user}
              onTeam={onTeam}
            />
          )}

          {/* ── Peer review (Phase 2.7) — only for signed-in members ───── */}
          {user && <PeerReviewSection project={project} user={user} />}

          {/* ── Apply form / current-status banner (signed-in members) ─── */}
          {isInternal && user && (
            <ApplySection
              project={project}
              user={user}
              myPending={myPending}
              myLatest={myLatest}
              onTeam={onTeam}
              acceptingApplicants={acceptingApplicants}
            />
          )}

          {/* ── Public "Offer to help" form — unauthenticated visitors ── */}
          {isInternal && !user && (
            <ProspectiveOfferSection
              project={project}
              accepting={acceptingOutsideOffers}
            />
          )}

          {!isInternal && (
            <Card>
              <CardEyebrow>External work</CardEyebrow>
              <p className="mt-2 text-sm text-ink-muted">
                Bidding on external client contracts goes through a
                structured quote sheet so the client sees one consistent
                proposal.
              </p>
              <Link
                href="/contracts"
                className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
              >
                Open the contracts queue →
              </Link>
            </Card>
          )}

          {/* ── Application queue (admins see all, members see their own) */}
          {isInternal && user && (
            <ApplicationQueue
              applications={allApps}
              isAdmin={isAdmin}
              currentUserId={user.id}
            />
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardEyebrow>Team</CardEyebrow>
            {project.assignedMemberIds.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                Open seat — looking for the right contributor.
              </p>
            ) : (
              <div className="mt-3">
                <TeamHand project={project} />
              </div>
            )}
          </Card>

          {user && isAdmin && isInternal && (
            <Card>
              <CardEyebrow>Admin</CardEyebrow>
              <p className="mt-2 text-sm text-ink-muted">
                {allApps.filter((a) => a.status === "pending").length} pending
                application
                {allApps.filter((a) => a.status === "pending").length === 1
                  ? ""
                  : "s"}{" "}
                across the cooperative.
              </p>
              <Link
                href="/admin/projects/applications"
                className="mt-3 inline-block rounded-full px-3 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "#D828A0" }}
              >
                Open applications queue →
              </Link>
              <Link
                href="/admin/projects/contributions"
                className="mt-2 inline-block rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
              >
                Outside contributor queue →
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Inline apply form / status banner for the signed-in member. */
function ApplySection({
  project,
  user,
  myPending,
  myLatest,
  onTeam,
  acceptingApplicants,
}: {
  project: (typeof MOCK_PROJECTS)[number];
  user: User;
  myPending: ProjectApplication | null;
  myLatest: ProjectApplication | null;
  onTeam: boolean;
  acceptingApplicants: boolean;
}) {
  // Already on the team — no form, just acknowledge.
  if (onTeam) {
    return (
      <Card className="border-[#007048]/40">
        <CardEyebrow>You're on this</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          You're contributing on {project.title}. Coordination happens in
          the cooperative channel — admin will loop in scope updates as
          they land.
        </p>
      </Card>
    );
  }

  // There's a pending application — show status + withdraw.
  if (myPending) {
    return (
      <Card className="border-[#5070F0]/40">
        <CardEyebrow>Your application</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Submitted {formatDate(myPending.createdAt)} for{" "}
          <span className="text-ink">"{myPending.proposedRole}"</span>.
          Pending admin review.
        </p>
        <p className="mt-3 text-xs italic text-ink-muted">
          "{myPending.pitch}"
        </p>
        <form action={withdrawProjectApplication} className="mt-4">
          <input type="hidden" name="id" value={myPending.id} />
          <input
            type="hidden"
            name="next"
            value={`/projects/${project.id}`}
          />
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Withdraw application
          </button>
        </form>
      </Card>
    );
  }

  // Decision already on file (rejected/withdrawn). Show outcome + allow re-apply.
  const decided =
    myLatest &&
    (myLatest.status === "rejected" || myLatest.status === "withdrawn")
      ? myLatest
      : null;

  if (!acceptingApplicants && !decided) {
    return (
      <Card>
        <CardEyebrow>Applications closed</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          {project.status === "completed"
            ? "This initiative wrapped up."
            : "Not currently accepting new contributors."}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardEyebrow>
        {decided ? "Apply again" : "Apply to contribute"}
      </CardEyebrow>
      {decided && (
        <p
          className="mt-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: STATUS_ACCENT[decided.status] + "55",
            color: STATUS_ACCENT[decided.status],
          }}
        >
          Last application:{" "}
          {PROJECT_APPLICATION_STATUS_LABELS[decided.status]} on{" "}
          {formatDate(decided.reviewedAt ?? decided.withdrawnAt ?? decided.createdAt)}.
          {decided.adminNote && (
            <span className="block mt-1 italic text-ink-muted">
              "{decided.adminNote}"
            </span>
          )}
        </p>
      )}

      <form
        action={applyToProject}
        className="mt-4 space-y-4 text-sm"
      >
        <input type="hidden" name="projectId" value={project.id} />

        <div>
          <label
            htmlFor="proposedRole"
            className="block text-xs uppercase tracking-wider text-ink-muted"
          >
            What role would you take?
          </label>
          <input
            id="proposedRole"
            name="proposedRole"
            type="text"
            required
            placeholder="e.g. Front-end pair, design lead, voice direction"
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="pitch"
            className="block text-xs uppercase tracking-wider text-ink-muted"
          >
            Why you, why now?
          </label>
          <textarea
            id="pitch"
            name="pitch"
            required
            rows={4}
            placeholder="Speak to the work — what you'd contribute, relevant past projects, anything we should know."
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="hoursPerWeek"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Hours per week
            </label>
            <input
              id="hoursPerWeek"
              name="hoursPerWeek"
              type="number"
              min={1}
              max={60}
              defaultValue={5}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="portfolioLink"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Reference link (optional)
            </label>
            <input
              id="portfolioLink"
              name="portfolioLink"
              type="url"
              placeholder="https://"
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <p className="text-[11px] text-ink-faint">
          Submitting as {publicName(user)}. Admin will review and notify
          you in your inbox — usually within a few days.
        </p>

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#5070F0" }}
        >
          Submit application
        </button>
      </form>
    </Card>
  );
}

/**
 * Public "Offer to help" form for unauthenticated visitors. Mirrors the
 * shape of ApplySection but writes a ProspectiveContribution row instead
 * of a ProjectApplication. Submitter never has to sign in; admin
 * triages in /admin/projects/contributions.
 */
function ProspectiveOfferSection({
  project,
  accepting,
}: {
  project: (typeof MOCK_PROJECTS)[number];
  accepting: boolean;
}) {
  if (!accepting) {
    return (
      <Card>
        <CardEyebrow>Outside contributions closed</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          {project.status === "completed"
            ? "This initiative wrapped up."
            : "Not accepting outside contributors right now."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-[#007048]/40">
      <CardEyebrow>Offer to help — no account needed</CardEyebrow>
      <p className="mt-2 text-sm text-ink-muted">
        You don&apos;t have to be in the cooperative to pitch in on this
        project. Tell us who you are, what you&apos;d take on, and how
        much time you can give. Admin reviews each offer and follows up
        by email — usually within a few days.
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        Submitting an offer doesn&apos;t grant cooperative standing. If
        you want that, see the three earned paths on{" "}
        <Link href="/whitelist" className="text-brand-magenta hover:underline">
          /whitelist
        </Link>
        .
      </p>

      <form
        action={submitProspectiveContribution}
        className="mt-5 space-y-4 text-sm"
      >
        <input type="hidden" name="projectId" value={project.id} />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="contactName"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Your name
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="contactEmail"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="proposedRole"
            className="block text-xs uppercase tracking-wider text-ink-muted"
          >
            What role would you take?
          </label>
          <input
            id="proposedRole"
            name="proposedRole"
            type="text"
            required
            placeholder="e.g. Front-end pair, design lead, voice direction"
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="pitch"
            className="block text-xs uppercase tracking-wider text-ink-muted"
          >
            How would you contribute?
          </label>
          <textarea
            id="pitch"
            name="pitch"
            required
            minLength={40}
            rows={4}
            placeholder="Speak to the work — what you'd bring, relevant past projects, how you found us, anything we should know."
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-ink-faint">
            40 characters minimum.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="hoursPerWeek"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Hours per week
            </label>
            <input
              id="hoursPerWeek"
              name="hoursPerWeek"
              type="number"
              min={0}
              max={60}
              defaultValue={4}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="portfolioLink"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Reference link (optional)
            </label>
            <input
              id="portfolioLink"
              name="portfolioLink"
              type="url"
              placeholder="https://"
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#007048" }}
        >
          Send offer
        </button>
      </form>
    </Card>
  );
}

/** Bottom-of-page list of all applications for this project. */
function ApplicationQueue({
  applications,
  isAdmin,
  currentUserId,
}: {
  applications: ProjectApplication[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  // Members only see their own rows; admins see everyone.
  const visible = isAdmin
    ? applications
    : applications.filter((a) => a.userId === currentUserId);

  if (visible.length === 0) return null;

  return (
    <Card>
      <CardEyebrow>
        {isAdmin ? "All applications" : "Your application history"}
      </CardEyebrow>
      <ul className="mt-3 divide-y divide-[var(--surface-border)] text-sm">
        {visible.map((a) => {
          const applicant = userById(a.userId);
          const accent = STATUS_ACCENT[a.status];
          return (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">
                  {isAdmin && applicant
                    ? `${adminName(applicant)} — `
                    : ""}
                  <span className="text-ink-muted">{a.proposedRole}</span>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                  style={{
                    backgroundColor: accent + "22",
                    color: accent,
                  }}
                >
                  {PROJECT_APPLICATION_STATUS_LABELS[a.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {a.hoursPerWeek}h/wk · {formatDate(a.createdAt)}
              </p>
              <p className="mt-1 text-xs italic text-ink-muted">"{a.pitch}"</p>
              {a.adminNote && (
                <p
                  className="mt-1 text-xs"
                  style={{ color: accent }}
                >
                  Admin: {a.adminNote}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {isAdmin && (
        <Link
          href="/admin/projects/applications"
          className="mt-4 inline-block text-xs text-brand-magenta hover:underline"
        >
          Decide pending applications →
        </Link>
      )}
    </Card>
  );
}

function ProjectMilestonesSection({
  project,
  user,
  onTeam,
}: {
  project: Project;
  user: User;
  onTeam: boolean;
}) {
  const milestones = milestonesForProject(project.id);
  if (milestones.length === 0) return null;

  const mine = milestones.filter((m) => m.ownerUserId === user.id);
  const isAdmin = user.isAdmin;

  return (
    <section className="space-y-4">
      <div>
        <CardEyebrow>Delivery cycle</CardEyebrow>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Milestone tracker
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Live status across the engagement. Owners can flip status and
          flag blockers on their own milestones below.
        </p>
      </div>

      <MilestoneTracker milestones={milestones} />

      {(mine.length > 0 || isAdmin) && (
        <Card>
          <CardEyebrow>
            {isAdmin ? "All milestones" : "Your milestones"}
          </CardEyebrow>
          <CardTitle className="mt-1 text-lg">
            {isAdmin ? "Admin view" : "Update status"}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            {isAdmin
              ? "You can update any milestone's status from here. Full admin tracker available below."
              : "Move your milestones forward as you ship them. Flag blockers early; admins get the ping immediately."}
          </p>

          <div className="mt-4 space-y-3">
            {(isAdmin ? milestones : mine).map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-[var(--surface-border)] p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-sm">{m.title}</strong>
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                    Due {new Date(m.dueAt).toLocaleDateString()}
                  </span>
                </div>
                {m.description && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {m.description}
                  </p>
                )}

                <form
                  action={updateMilestoneStatus}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <label className="flex flex-col text-[10px] uppercase tracking-wider text-ink-faint">
                    Status
                    <select
                      name="status"
                      defaultValue={m.status}
                      className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-sm normal-case tracking-normal text-ink"
                    >
                      {TALENT_MILESTONE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {MILESTONE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-1 min-w-[180px] flex-col text-[10px] uppercase tracking-wider text-ink-faint">
                    Blocker note (only if blocked)
                    <input
                      type="text"
                      name="blockerNote"
                      defaultValue={m.blockerNote ?? ""}
                      placeholder="What needs to clear before this can move?"
                      className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1 text-sm normal-case tracking-normal text-ink placeholder:text-ink-faint"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
                  >
                    Save
                  </button>
                </form>
              </div>
            ))}
          </div>

          {isAdmin && (
            <Link
              href={`/admin/contracts/${project.id}/tracker`}
              className="mt-4 inline-block text-xs text-brand-magenta hover:underline"
            >
              Full admin tracker →
            </Link>
          )}
        </Card>
      )}

      {!onTeam && !isAdmin && mine.length === 0 && (
        <p className="text-xs text-ink-faint">
          You aren't on this engagement&apos;s team, so milestone editing
          is read-only.
        </p>
      )}
    </section>
  );
}

/**
 * Team hand — assigned crew rendered as a dealt hand of cards. Retro
 * view: no selection actions (the crew is locked in), just a
 * curated presentation of who's on this. Sets up the pattern for the
 * client-facing quote surface where the same shape gets selection
 * actions layered on.
 */
function TeamHand({ project }: { project: Project }) {
  const courtIds = new Set(championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS));

  const entries: TalentHandEntry[] = project.assignedMemberIds
    .map((memberId): TalentHandEntry | null => {
      const user = MOCK_USERS.find((u) => u.id === memberId);
      if (!user) return null;
      const mvpSnapshot = mvpScoreForUser(user.id);
      const tier = deriveTradingCardTier({
        ovr: mvpSnapshot ? mvpSnapshot.ovr : null,
        isProvisional: mvpSnapshot?.isProvisional ?? false,
        isInChampionsCourt: courtIds.has(user.id),
      });
      const entry: TalentHandEntry = {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          handle: user.handle,
          profileImageUrl: user.profileImageUrl,
          avatarPortraitUrl: user.avatarPortraitUrl,
          discipline: user.discipline,
          membershipTier: user.membershipTier,
        },
        tier,
      };
      // Discipline reads as the relevance line for retro views —
      // future quote-side wiring provides real "why this person"
      // narrative per card.
      if (user.primaryIndustry) {
        entry.relevance = `${INDUSTRY_LABELS[user.primaryIndustry]} lead on this engagement.`;
      }
      return entry;
    })
    .filter((e): e is TalentHandEntry => e !== null);

  if (entries.length === 0) return null;

  return <TalentHand entries={entries} deal aspectRatio="3/4" />;
}
