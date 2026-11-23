/**
 * "How was it run?" — the counterpart to peer review.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-23)
 *
 * Peer review rates delivery. This rates management, and until now
 * the direction did not exist: clients rated the cooperative, peers
 * rated each other, and nobody rated the person who scoped the work,
 * staffed it, held the client and got everyone paid.
 *
 * Jamar, on why it matters: "sometimes management is the problem."
 * Without this, a badly-run engagement still produces only a review
 * of the people who delivered it.
 *
 * WHO SEES IT
 *
 * Everyone the split pays, rating the admins on the engagement. A
 * contributor rates whoever ran it; an admin rates the other admins,
 * because Rob reviewing Jamar is a real review. Nobody rates
 * themselves, and an admin who is the only admin sees nothing.
 *
 * WHY IT RENDERS SEPARATELY FROM PEER REVIEW
 *
 * Different questions about different work. Folding admins into the
 * peer list would mean rating somebody who never wrote a line on
 * Craft, which is asking the wrong question politely and getting an
 * answer that means nothing.
 *
 * Server component: the reads happen here and the client piece takes
 * ids and names only.
 * ─────────────────────────────────────────────────────────────
 */
import { AdminReviewForm } from "@/components/AdminReviewForm";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  adminReviewReader,
  getEngagementRoles,
  safely,
} from "@/lib/readers";
import { EngagementRolePicker } from "@/components/EngagementRolePicker";
import { axesFor, describeRoles } from "@/lib/engagement-roles";
import { getAllUsers } from "@/lib/readers/users";
import { publicName, type Project, type User } from "@/lib/types";

export async function AdminReviewSection({
  project,
  user,
}: {
  project: Project;
  user: User;
}) {
  if (project.status !== "completed") return null;

  // Everyone the split pays. See the peer review section for why this
  // is the union rather than assignedMemberIds alone.
  const onEngagement = new Set([
    ...(project.assignedMemberIds ?? []),
    ...(project.adminUserIds ?? []),
  ]);
  if (!onEngagement.has(user.id)) return null;

  // The people who ran it, minus yourself.
  const subjects = (project.adminUserIds ?? []).filter((id) => id !== user.id);
  if (subjects.length === 0) return null;

  const [{ users: roster }, mine, roles] = await Promise.all([
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    // Only this reviewer's own rows, so the component never holds
    // anyone else's attribution in the first place.
    safely(() => adminReviewReader.all(), []),
    // What each person did, which decides what anyone may be asked.
    safely(
      () => getEngagementRoles(project.id),
      new Map<string, string[]>(),
    ),
  ]);
  const byId = new Map(roster.map((u) => [u.id, u]));
  const alreadyReviewed = new Set(
    mine
      .filter(
        (r) => r.projectId === project.id && r.reviewerUserId === user.id,
      )
      .map((r) => r.subjectUserId),
  );

  const people = subjects
    .map((id) => byId.get(id))
    .filter((u): u is User => Boolean(u));
  if (people.length === 0) return null;

  return (
    <Card className="border-[#B4740F]/40">
      <CardEyebrow>How it was run</CardEyebrow>
      <CardTitle className="mt-2">
        {people.length === 1
          ? `Rate how ${publicName(people[0])} ran this`
          : `Rate the ${people.length} people who ran this`}
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        Separate from the work itself. Scoping, answering you, absorbing
        client changes, paying on time. If the management was the weak
        part of {project.title}, this is where that gets recorded
        instead of landing on whoever delivered.
      </p>

      <div className="mt-5 space-y-5">
        {people.map((person) => (
          <div
            key={person.id}
            className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4"
          >
            <div className="mb-3 font-medium">{publicName(person)}</div>
            {(() => {
              const theirRoles = roles.get(person.id) ?? [];
              const axes = axesFor(theirRoles);

              if (alreadyReviewed.has(person.id)) {
                return (
                  <p className="text-sm text-ink-muted">
                    Submitted. Thanks — it is in the aggregate now.
                  </p>
                );
              }

              // Nothing to ask until somebody says what they did.
              // Jamar: "I / a member admin should be assigning roles
              // at review." So an admin gets the picker here, and a
              // contributor is told it is being waited on rather than
              // handed a control that is not theirs.
              if (axes.length === 0) {
                return user.isAdmin ? (
                  <>
                    <p className="text-sm text-ink-muted">
                      No roles set, so there is nothing fair to ask about
                      them yet.
                    </p>
                    <EngagementRolePicker
                      projectId={project.id}
                      userId={person.id}
                      personName={publicName(person)}
                      current={theirRoles}
                    />
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">
                    Waiting on an admin to record what{" "}
                    {publicName(person)} did on this engagement. You will
                    be asked only about that.
                  </p>
                );
              }

              return (
                <>
                  <p className="mb-2 text-[11px] text-ink-faint">
                    {describeRoles(theirRoles)}
                  </p>
                  <AdminReviewForm
                    projectId={project.id}
                    subjectUserId={person.id}
                    subjectName={publicName(person)}
                    axes={axes}
                  />
                  {user.isAdmin && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[11px] text-ink-faint hover:text-ink-muted">
                        Change what they did
                      </summary>
                      <EngagementRolePicker
                        projectId={project.id}
                        userId={person.id}
                        personName={publicName(person)}
                        current={theirRoles}
                      />
                    </details>
                  )}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </Card>
  );
}
