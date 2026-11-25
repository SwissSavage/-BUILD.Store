/**
 * Reviews for one engagement. Its own surface.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS ROUTE EXISTS (2026-11-24)
 *
 * Jamar: "The section should be accessible directly from the contract,
 * the reviews themselves should not be handled on contract."
 *
 * EngagementReviewsPanel was rendered inside the ledger, so chasing a
 * review meant opening a page about money, and the only door to it was
 * that one page. Settlement already has several entries; reviews had
 * one, and it was the wrong one.
 *
 * So the chasing, the role assignment and the collected state live
 * here, linked from the contract rather than embedded in it. The
 * ledger keeps a pointer and nothing else.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT SHOWS THE BLEND
 *
 * Because reviews are no longer only about standing. Since
 * drizzle/0055 the client, peer and PM slots decide what share of the
 * Bonus Margin was earned, and an admin looking at review coverage is
 * looking at the inputs to a payout. Showing which slots are empty is
 * the difference between "we are waiting on feedback" and "this will
 * settle on two readings out of three."
 *
 * Attribution stays off this page. Who said what is admin-only and
 * lives behind /admin/peer-reviews, for the reason written on
 * admin-review-score: on an engagement with one Builder, an
 * attributed view names the author however carefully it is phrased.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import { clients as clientsTable } from "@/db/schema";
import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  adminReviewReader,
  customerFeedbackReader,
  getEngagementRoles,
  getReviewsForProject,
  safely,
} from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import { EngagementReviewsPanel } from "@/components/EngagementReviewsPanel";
import { EngagementRolePicker } from "@/components/EngagementRolePicker";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { blendRating } from "@/lib/bonus-reconciliation";
import { buildRatingSignals } from "@/lib/readers/rating-signals";
import { formatStars, isHalfStep } from "@/lib/ratings";
import { describeRoles } from "@/lib/engagement-roles";
import { undeliveredRequests } from "@/lib/writers/feedback-dispatch";
import { ReviewSlotPicker } from "@/components/ReviewSlotPicker";
import { DispositionPanel } from "@/components/DispositionPanel";
import { getReviewSlots } from "@/lib/readers";
import { slotAssignment } from "@/lib/review-slots";
import { engagementBenchings } from "@/db/schema";
import { publicName, type User } from "@/lib/types";

export default async function ContractReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await getCurrentUser();
  if (!admin) redirect("/signin");
  if (!admin.isAdmin) redirect("/dashboard");

  const project = await getProjectById(id);
  if (!project || project.kind !== "contract") notFound();

  const [{ users: roster }, peerReviews, adminRevs, feedbackAll, roles] =
    await Promise.all([
      safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
      safely(() => getReviewsForProject(project.id), []),
      safely(() => adminReviewReader.all(), []),
      safely(() => customerFeedbackReader.all(), []),
      safely(
        () => getEngagementRoles(project.id),
        new Map<string, string[]>(),
      ),
    ]);

  const clientEmail = await safely(async () => {
    if (!project.clientRefId) return null;
    const [row] = await db
      .select({ email: clientsTable.primaryContactEmail })
      .from(clientsTable)
      .where(eq(clientsTable.id, project.clientRefId))
      .limit(1);
    return row?.email ?? null;
  }, null);

  const feedback = feedbackAll.filter((f) => f.contextId === project.id);
  const slots = await safely(
    () => getReviewSlots(project.id),
    new Map<string, "peer" | "pm">(),
  );
  const benchings = await safely(
    () =>
      db
        .select()
        .from(engagementBenchings)
        .where(eq(engagementBenchings.projectId, project.id)),
    [] as (typeof engagementBenchings.$inferSelect)[],
  );
  // Pending counts as undelivered: a token whose send never reported
  // either way is exactly as un-arrived as one that bounced.
  const undelivered = (
    await safely(() => undeliveredRequests(project.id), [])
  ).filter((u) => u.status !== "sent");
  const byId = new Map(roster.map((u) => [u.id, u]));

  // Everyone the split pays — the same union the review sections use,
  // because an engagement's membership is whoever the money reaches.
  const onEngagement = [
    ...new Set([
      ...(project.assignedMemberIds ?? []),
      ...(project.adminUserIds ?? []),
    ]),
  ]
    .map((uid) => byId.get(uid))
    .filter((u): u is User => Boolean(u));

  // ONE builder, shared with executeBonusDecision. This page used to
  // have its own line putting every peer review into the peer slot,
  // so the blend an admin read here was computed by different rules
  // than the blend that decides the Bonus Margin — and the display
  // was the stale one, which is the worse way round.
  const signals = await buildRatingSignals(project);
  const blend = blendRating(signals);
  const hasMargin = Number(project.talentBonusAmount ?? 0) > 0;
  const contributorIds = new Set(project.assignedMemberIds ?? []);
  // Slots are only assignable where the peer slot cannot fill itself.
  // The action re-checks this; the page just decides whether to offer
  // the control.
  const slotsAssignable = slotAssignment({
    partyUserIds: onEngagement.map((p) => p.id),
  });
  const uncommitted = Number(project.bonusUncommittedAmount ?? 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={`/admin/contracts/${project.id}`}
        className="text-xs text-ink-muted hover:text-brand-magentaText"
      >
        ← {project.title}
      </Link>

      <h1 className="mt-3 font-display text-3xl font-semibold">Reviews</h1>
      <p className="mt-1 text-sm text-ink-muted">
        How this engagement went, from the client, from peers, and on how
        it was run. Scores are visible; who gave them is not.
      </p>

      {/* ── What the slots currently hold ───────────────────────── */}
      <Card className="mt-6">
        <CardEyebrow>Collected so far</CardEyebrow>
        <CardTitle className="mt-1 text-2xl">
          {blend.value === null
            ? "Nothing back yet"
            : `Blended ${formatStars(blend.value)} of 5`}
        </CardTitle>
        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          {(
            [
              ["Client", 0.4, signals.client],
              ["Peer", 0.4, signals.peer],
              ["PM", 0.2, signals.pm],
            ] as const
          ).map(([label, weight, values]) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--surface-border)] p-3"
            >
              <div className="text-[11px] uppercase tracking-wider text-ink-muted">
                {label} · {weight}
              </div>
              <div className="mt-1 text-lg tabular-nums">
                {values.length > 0
                  ? `${formatStars(values.reduce((a, b) => a + b, 0) / values.length)}★`
                  : "—"}
              </div>
              <div className="text-[11px] text-ink-faint">
                {values.length} reading{values.length === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
        {/*
          An empty slot is not a zero. Said here because an admin
          reading "—" needs to know it renormalizes away rather than
          dragging the blend down, which is the opposite of what a
          missing number usually means on a dashboard.
        */}
        <p className="mt-3 text-[11px] text-ink-faint">
          An empty slot renormalizes away rather than counting as a low
          score.{" "}
          {hasMargin
            ? "This blend decides what share of the Bonus Margin is earned."
            : "There is no Bonus Margin on this engagement, so nothing here affects pay — it feeds standing only."}
        </p>
      </Card>

      {/* ── Requests that did not arrive ────────────────────────── */}
      {undelivered.length > 0 && (
        <Card className="mt-6 border-[#B4740F]/40">
          <CardEyebrow>Delivery</CardEyebrow>
          <CardTitle className="mt-1 text-xl">
            {undelivered.length} request
            {undelivered.length === 1 ? "" : "s"} did not arrive
          </CardTitle>
          {/*
            Surfaced loudly because of what silence costs. A request
            that never lands leaves the client slot empty, an empty
            slot renormalizes away, and an engagement with no readings
            at all earns the FULL Bonus Margin. A broken mail path
            therefore pays every margin in full, quietly. This is the
            only place that failure becomes visible.
          */}
          <p className="mt-2 text-sm text-ink-muted">
            Nobody decides whether the client is asked — requests go out
            on milestone completion. These attempts failed, so the
            client slot is empty for reasons on our side, not theirs.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {undelivered.map((u) => (
              <li
                key={u.token}
                className="rounded-lg border border-[var(--surface-border)] p-2"
              >
                <span className="font-medium">
                  {u.recipientEmail ?? "no address on file"}
                </span>{" "}
                <span className="text-ink-faint">
                  · {u.status} · {u.attempts} attempt
                  {u.attempts === 1 ? "" : "s"}
                </span>
                {u.error && (
                  <p className="mt-1 break-words text-[11px] text-ink-faint">
                    {u.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Who still owes an answer ────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">Outstanding</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Who has not answered yet, and a nudge for each.
        </p>
        <EngagementReviewsPanel project={project} clientEmail={clientEmail} />
      </section>

      {/* ── Which way it went ───────────────────────────────────── */}
      {(uncommitted > 0 || project.dispositionKind) && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Direction</h2>
          <p className="mt-1 text-sm text-ink-muted">
            The margin came up short. The payouts already landed — this
            records what follows, and moves nothing.
          </p>
          <div className="mt-4">
            <DispositionPanel
              projectId={project.id}
              uncommittedLabel={`$${uncommitted.toLocaleString()}`}
              people={onEngagement.map((p) => ({
                id: p.id,
                name: publicName(p),
                isContributor: contributorIds.has(p.id),
              }))}
              existing={
                project.dispositionKind
                  ? {
                      kind: project.dispositionKind,
                      reason: project.dispositionReason ?? "",
                      at: project.dispositionAt,
                    }
                  : null
              }
            />
          </div>
        </section>
      )}

      {/* ── Who came off ────────────────────────────────────────── */}
      {benchings.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Benched</h2>
          {/*
            Shown on the engagement, not buried in an audit log,
            because it is a contract result: it reads at conclusion
            beside the ratings and follows the person into their
            grading.
          */}
          <p className="mt-1 text-sm text-ink-muted">
            Taken off this engagement before it ended. Still on the
            record for it.
          </p>
          <ul className="mt-3 space-y-2">
            {benchings.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-[#B4740F]/40 p-3 text-sm"
              >
                <span className="font-medium">
                  {publicName(byId.get(b.userId) ?? ({} as User)) ||
                    "Unknown member"}
                </span>
                {b.replacedByUserId && (
                  <span className="text-ink-muted">
                    {" "}
                    → replaced by{" "}
                    {publicName(
                      byId.get(b.replacedByUserId) ?? ({} as User),
                    ) || "someone off this engagement"}
                  </span>
                )}
                <p className="mt-1 text-[11px] text-ink-faint">{b.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Scope: what each person did ─────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          What each person did
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Roles decide which questions anyone is asked about them.
          Nobody is rated on work they did not do, and that is declared
          here rather than inferred.
        </p>
        <div className="mt-4 space-y-3">
          {onEngagement.map((person) => (
            <div
              key={person.id}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{publicName(person)}</span>
                <span className="text-[11px] text-ink-faint">
                  {describeRoles(roles.get(person.id) ?? [])}
                </span>
              </div>
              {/*
                The six roles describe RUNNING an engagement —
                holding the client, directing the work, paying
                people. They were drawn up as examples for admins,
                and showing them to the person who did the work asks
                a service provider to tick "Payments" or "Client
                owner" about themselves, which is nonsense.

                Jamar: "I was giving the 6 roles as examples for
                admin specifically. There's nothing here for service
                providers."

                So the picker is for the people who ran it. What a
                contributor carries instead is still open, and
                guessing at a second taxonomy is how this got wrong
                the first time.
              */}
              {!contributorIds.has(person.id) && (
                <EngagementRolePicker
                projectId={project.id}
                userId={person.id}
                personName={publicName(person)}
                  current={roles.get(person.id) ?? []}
                />
              )}
              {contributorIds.has(person.id) && (
                <p className="mt-2 text-[11px] text-ink-faint">
                  Did the work on this engagement. The peer questions
                  — craft, reliability, collaboration, communication —
                  apply to anyone who delivered, so there is nothing
                  to narrow here yet.
                </p>
              )}
              {/*
                A second, separate assignment. Roles say what this
                person is asked about; the slot says what their own
                rating counts as. Only offered where the peer slot
                cannot fill itself.
              */}
              {slotsAssignable.available && (
                <ReviewSlotPicker
                  projectId={project.id}
                  userId={person.id}
                  personName={publicName(person)}
                  current={slots.get(person.id) ?? null}
                  isContributor={contributorIds.has(person.id)}
                />
              )}
            </div>
          ))}
          {onEngagement.length === 0 && (
            <p className="text-sm text-ink-muted">
              Nobody is attached to this engagement yet.
            </p>
          )}
        </div>
      </section>

      <p className="mt-10 text-[11px] text-ink-faint">
        Attributed reviews — who said what — are at{" "}
        <Link
          href="/admin/peer-reviews"
          className="underline hover:text-brand-magentaText"
        >
          /admin/peer-reviews
        </Link>
        , and never show you rows about yourself. Adding them here would
        name the author on any engagement with one Builder.
      </p>
      <p className="mt-2 text-[11px] text-ink-faint">
        {adminRevs.filter((r) => r.projectId === project.id).length} review
        {adminRevs.filter((r) => r.projectId === project.id).length === 1
          ? ""
          : "s"}{" "}
        of how it was run.
      </p>
    </div>
  );
}
