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
 * So this is a pointer. The forms are at /projects/[id]/reviews.
 *
 * ─────────────────────────────────────────────────────────────
 * THE PATHWAY IS ALWAYS HERE
 *
 * First version only rendered once a round was open, which meant the
 * deal page showed nothing about reviews most of the time. Jamar: "I
 * asked for a pathway to reviews, not to have them right on the page.
 * You over corrected."
 *
 * Exactly right. Taking the forms off was the ask; taking the way in
 * off with them was not. A door that appears only when somebody else
 * has already opened the room is not a door.
 *
 * So the pathway stands on every completed engagement whatever the
 * round is doing, and what changes is what it says and where it
 * points. An admin gets the management surface as well, because an
 * admin standing on the deal had no route to it at all.
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

  const status = round?.status ?? null;
  const closed = status === "closed";
  const open = status === "open";

  // The cursory view: the stage, and nothing a score or a person
  // could be read out of.
  if (!participant) {
    if (!status) return null;
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
        {closed
          ? "Reviews are closed"
          : open
            ? "Reviews are open"
            : "Reviews have not gone out yet"}
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        {closed
          ? "This round is finished. Scores are visible to the person rated; who said what is not."
          : open
            ? "Everyone on this engagement was asked at the same time. Scores reach the person rated; who said what does not."
            : "An admin opens the round once this is wrapped, and everyone is asked at once."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {open && (
          <Link
            href={`/projects/${project.id}/reviews`}
            className="rounded-full px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#5070F0" }}
          >
            Leave your reviews →
          </Link>
        )}
        {/*
          The admin route. Without this an admin standing on the deal
          had nowhere to go: every entry point to the review dashboard
          was on the admin side of the app.
        */}
        {user.isAdmin && (
          <Link
            href={`/admin/contracts/${project.id}/reviews`}
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta hover:text-brand-magentaText"
          >
            {status ? "Manage reviews" : "Set up reviews"} →
          </Link>
        )}
      </div>
    </Card>
  );
}
