/**
 * Which reviews are in, and who to chase — on the contract itself.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-23)
 *
 * Jamar: "I don't see any of the options from the admin/reserve etc.
 * in the side scroll menu. They should also be manageable/accessible
 * from the project tab for admins. Just like we did with the
 * settlement layer."
 *
 * The chase actions existed, on /admin/reserve, which the menu calls
 * "Contract reserves" and files under Money. Nobody looking for
 * review chasing would open that, and the label is not wrong — the
 * page is about bonus release and the ratings are an input to it.
 *
 * Worse, the chase UI there is gated:
 *
 *   bonusPending && project.talentBonusAmount && contribs.length > 0
 *
 * So on an engagement with no pending talent bonus the controls do
 * not render anywhere at all, and AWS is exactly that engagement.
 * The ratings are not only for releasing a bonus: they are how the
 * cooperative finds out how a job went.
 *
 * This panel is ungated and lives on the contract, the same move as
 * the "Log payments" prompt on the payouts section.
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT IT WILL NOT DO
 *
 * It shows WHETHER a review is on file and never what it said. Scores
 * and prose belong on the surfaces built for them, with the
 * anonymity rules those carry. A panel whose job is "who still owes
 * us an answer" does not need to show the answers, and showing them
 * here would quietly put attribution on a page an admin opens for
 * another reason entirely.
 * ─────────────────────────────────────────────────────────────
 */
import { Button } from "@/components/Button";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  remindClientForFeedback,
  remindPeersForRating,
  remindPmForRating,
} from "@/lib/chase-actions";
import {
  adminReviewReader,
  customerFeedbackReader,
  getReviewsForProject,
  safely,
} from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import { publicName, type Project, type User } from "@/lib/types";

export async function EngagementReviewsPanel({
  project,
  clientEmail,
}: {
  project: Project;
  /** Prefills the client nudge. Null when no contact is on file. */
  clientEmail: string | null;
}) {
  if (project.kind !== "contract") return null;

  const [{ users: roster }, peerReviews, adminRevs, feedback] =
    await Promise.all([
      safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
      safely(() => getReviewsForProject(project.id), []),
      safely(() => adminReviewReader.all(), []),
      safely(() => customerFeedbackReader.all(), []),
    ]);

  const byId = new Map(roster.map((u) => [u.id, u]));
  const contributors = (project.assignedMemberIds ?? [])
    .map((id) => byId.get(id))
    .filter((u): u is User => Boolean(u));
  const admins = (project.adminUserIds ?? [])
    .map((id) => byId.get(id))
    .filter((u): u is User => Boolean(u));

  const mine = adminRevs.filter((r) => r.projectId === project.id);
  const clientDone = feedback.some((f) => f.contextId === project.id);

  // Counts only. See the header on why no scores appear here.
  const peerCountFor = (id: string) =>
    peerReviews.filter((r) => r.revieweeId === id && !r.voidedAt).length;
  const adminCountFor = (id: string) =>
    mine.filter((r) => r.subjectUserId === id).length;

  const notComplete = project.status !== "completed";

  return (
    <Card className="mt-4">
      <CardEyebrow>Reviews</CardEyebrow>
      <CardTitle className="mt-1 text-lg">
        How this engagement went
      </CardTitle>

      {notComplete && (
        <p
          className="mt-2 rounded-lg px-3 py-2 text-sm"
          style={{
            backgroundColor: "rgba(180, 116, 15, 0.12)",
            color: "#B4740F",
          }}
        >
          {/*
            The single most common reason a review round produces
            nothing. Every gate checks it, so saying it here saves an
            admin chasing people toward a form that will not render.
          */}
          This engagement is not marked complete, so none of the review
          forms will appear for anyone yet.
        </p>
      )}

      <div className="mt-4 space-y-3 text-sm">
        {/* ── Delivery ─────────────────────────────────── */}
        {contributors.map((u) => {
          const n = peerCountFor(u.id);
          return (
            <div
              key={`peer-${u.id}`}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-3"
            >
              <span>
                <span className="font-medium">{publicName(u)}</span>
                <span className="text-ink-muted"> · delivery</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={n > 0 ? "" : "text-ink-faint"}>
                  {n > 0 ? `${n} on file` : "none yet"}
                </span>
                <form action={remindPeersForRating}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="contributorId" value={u.id} />
                  <Button
                    type="submit"
                    className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magentaText"
                  >
                    Nudge
                  </Button>
                </form>
              </span>
            </div>
          );
        })}

        {/* ── Management ───────────────────────────────── */}
        {admins.map((u) => {
          const n = adminCountFor(u.id);
          return (
            <div
              key={`admin-${u.id}`}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-3"
            >
              <span>
                <span className="font-medium">{publicName(u)}</span>
                <span className="text-ink-muted"> · ran it</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={n > 0 ? "" : "text-ink-faint"}>
                  {n > 0 ? `${n} on file` : "none yet"}
                </span>
                <form action={remindPmForRating}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <Button
                    type="submit"
                    className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magentaText"
                  >
                    Nudge
                  </Button>
                </form>
              </span>
            </div>
          );
        })}

        {/* ── Client ───────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="font-medium">The client</span>
            <span className="text-ink-muted"> · questionnaire</span>
          </span>
          <span className="flex items-center gap-3">
            <span className={clientDone ? "" : "text-ink-faint"}>
              {clientDone ? "submitted" : "none yet"}
            </span>
            {!clientDone && (
              <form
                action={remindClientForFeedback}
                className="flex items-center gap-1"
              >
                <input type="hidden" name="projectId" value={project.id} />
                <input
                  name="clientEmail"
                  type="email"
                  required
                  defaultValue={clientEmail ?? ""}
                  placeholder="client@example.com"
                  className="w-48 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                />
                <Button
                  type="submit"
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magentaText"
                >
                  Send link
                </Button>
              </form>
            )}
          </span>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink-faint">
        Counts only. What anyone said lives on the review surfaces,
        where the anonymity rules apply.
      </p>
    </Card>
  );
}
