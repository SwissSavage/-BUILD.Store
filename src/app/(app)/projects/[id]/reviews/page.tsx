/**
 * Where a participant actually leaves their reviews.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THE DEAL PAGE (2026-11-25)
 *
 * Jamar: "We don't want reviews literally happening on the deal", and
 * "Reviews need their own section, just like settlement."
 *
 * PeerReviewSection and AdminReviewSection used to render inside
 * /projects/[id], live from the moment a contract hit completed. That
 * put rating a person on the page about the work, with no
 * configuration step in front of it and no moment where everyone was
 * asked together. Settlement has never worked that way.
 *
 * Two gates, both enforced here and again in the actions:
 *
 *   on the engagement   "only people on the deal should see the
 *                       reviews or be involved with the review
 *                       process."
 *   round is open       "If I'm not configuring a review to reach the
 *                       customer and related parties there shouldn't
 *                       be any reviewing happening at all", and
 *                       nothing until everyone holds the link.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import { reviewGateState } from "@/lib/readers/review-rounds";
import { safely } from "@/lib/readers";
import { PeerReviewSection } from "@/components/PeerReviewSection";
import { AdminReviewSection } from "@/components/AdminReviewSection";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function ParticipantReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const project = await getProjectById(id);
  if (!project) notFound();

  // Everyone the split pays, and nobody else. A visitor reading a
  // completed contract should not learn a round is underway.
  const onEngagement = new Set([
    ...(project.assignedMemberIds ?? []),
    ...(project.adminUserIds ?? []),
  ]);
  if (!onEngagement.has(user.id)) notFound();

  const gate = await safely(() => reviewGateState(project.id), {
    open: false,
    round: null,
    waitingOn: [],
    reason: "no_round" as const,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/projects/${project.id}`}
        className="text-xs text-ink-muted hover:text-brand-magentaText"
      >
        ← {project.title}
      </Link>

      <h1 className="mt-3 font-display text-3xl font-semibold">Your reviews</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Everyone on this engagement was asked at the same time. Scores
        reach the person rated; who said what does not.
      </p>

      {!gate.open ? (
        <Card className="mt-6">
          <CardEyebrow>Not open</CardEyebrow>
          <CardTitle className="mt-1 text-xl">
            {gate.reason === "closed"
              ? "This round is closed"
              : gate.reason === "awaiting_delivery"
                ? "Waiting on everyone to receive the link"
                : "No review round has been opened yet"}
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            {gate.reason === "closed"
              ? "Submissions have ended and the result is final."
              : gate.reason === "awaiting_delivery"
                ? `${gate.waitingOn.length} ${gate.waitingOn.length === 1 ? "person has" : "people have"} not received it yet. Reviewing opens for everybody together, so nobody is rated by a partial room.`
                : "An admin opens the round once the engagement is wrapped, and everyone is asked at once."}
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          <PeerReviewSection project={project} user={user} />
          <AdminReviewSection project={project} user={user} />
        </div>
      )}
    </div>
  );
}
