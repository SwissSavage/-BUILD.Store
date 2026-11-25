/**
 * The way in to reviews, on the deal. Not the reviews themselves.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY ONLY A DOOR (2026-11-25)
 *
 * Jamar: "We don't want reviews literally happening on the deal",
 * and "Reviews need their own section, just like settlement."
 *
 * PeerReviewSection and AdminReviewSection used to render right here,
 * so rating a person sat on the page about the work and went live the
 * moment the contract hit completed. Settlement has never worked that
 * way — it is a section you go to, reachable from several places —
 * and reviews are at least as consequential, because the blend they
 * produce decides what share of the Bonus Margin is earned.
 *
 * So this is a pointer and a count of what is outstanding. The forms
 * are at /projects/[id]/reviews.
 *
 * ─────────────────────────────────────────────────────────────
 * CURSORY FOR EVERYONE, CONCRETE FOR PARTICIPANTS
 *
 * I had this render nothing at all for anyone off the engagement.
 * Jamar: "I don't mind people seeing project stages in a cursory
 * manner as long as nothing concrete is leaked."
 *
 * So the stage is public and the substance is not. A passer-by learns
 * that this engagement reached its review stage, which is no more
 * than the pipeline already tells them. What they do not get is the
 * action, who still owes one, how many came back, or anything a
 * score could be inferred from.
 *
 * The line is "concrete", not "exists". Hiding the stage entirely was
 * me reading "only people on the deal should be involved with the
 * review process" as a visibility rule when it is a participation
 * rule.
 *
 * Server component: the reads happen here.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { getReviewRound } from "@/lib/readers/review-rounds";
import { safely } from "@/lib/readers";
import type { Project, User } from "@/lib/types";

export async function ReviewsDoor({
  project,
  user,
}: {
  project: Project;
  user: User;
}) {
  if (project.status !== "completed") return null;

  // Everyone the split pays. Same union the review surfaces use,
  // because an engagement's membership is whoever the money reaches.
  const onEngagement = new Set([
    ...(project.assignedMemberIds ?? []),
    ...(project.adminUserIds ?? []),
  ]);
  const participant = onEngagement.has(user.id);

  const round = await safely(() => getReviewRound(project.id), null);

  // Nothing to say until an admin has opened the round. Before that
  // there is no review to leave, and announcing a draft would invite
  // a contributor to ask why it has not gone out.
  if (!round || round.status === "draft") return null;

  const closed = round.status === "closed";

  // The cursory view: the stage, and nothing a score or a person
  // could be read out of.
  if (!participant) {
    return (
      <Card className="mt-6">
        <CardEyebrow>Reviews</CardEyebrow>
        <CardTitle className="mt-2">
          {closed ? "Reviewed" : "In review"}
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Everyone who worked on this was asked about it together.
          Results stay with the people involved.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-[#5070F0]/40">
      <CardEyebrow>Reviews</CardEyebrow>
      <CardTitle className="mt-2">
        {closed ? "Reviews are closed" : "Reviews are open for this engagement"}
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        {closed
          ? "This round has been closed. What was said is in the aggregate; scores are visible, who said what is not."
          : "Everyone on this engagement was asked at the same time. Scores are visible to the person rated; who said what is not."}
      </p>
      {!closed && (
        <Link
          href={`/projects/${project.id}/reviews`}
          className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#5070F0" }}
        >
          Leave your reviews →
        </Link>
      )}
    </Card>
  );
}
