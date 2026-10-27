/**
 * Client tracker — read-only progress view, opened from a link.
 *
 * Auth-free by design: clients never had a $BUILD.Store login and are
 * not going to get one.
 *
 * No PII surfaced beyond what the rest of the platform already exposes:
 * milestone titles, statuses, due dates, owner first names via
 * publicName. No internal notes, no admin notes, no member emails.
 *
 * ─────────────────────────────────────────────────────────────
 * TOKEN RAIL (2026-10-24)
 *
 * This page gated on a three-entry map written into this file, and one
 * entry was `demo: "*"`, which authorized every project id. Anyone
 * appending ?token=demo read the milestone board of any contract in
 * the database. The other two pointed at seed contracts p_003 and
 * p_004, so no real client ever had a working link and none could be
 * made.
 *
 * The identical bug was found and fixed on /contracts/[id]/feedback on
 * 2026-09-04. The fix did not travel to the file next door.
 *
 * Tokens now come from `project_tracker_tokens`, minted by an admin on
 * /admin/contracts/[id]/tracker. resolveTrackerToken is the single
 * definition of a valid link.
 *
 * The client label was a three-entry map too, for the same three seed
 * clients, so a real engagement rendered its raw clientId — usually an
 * internal identifier, sometimes a user id — as the client's own name
 * at the top of their tracker. It now renders the title alone, since
 * the one person guaranteed to know who the client is, is the client.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/readers/projects";
import { getAllUsers } from "@/lib/readers/users";
import { getMilestonesForProject, safely } from "@/lib/readers";
import { publicName } from "@/lib/types";
import {
  resolveTrackerToken,
  touchTrackerToken,
} from "@/lib/tracker-link-tokens";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { MilestoneTracker } from "@/components/MilestoneTracker";

export const dynamic = "force-dynamic";

export default async function ClientTrackerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const resolution = await resolveTrackerToken(token, id);
  // Reader swap 2026-08-29: was MOCK_PROJECTS/MOCK_USERS. This is the
  // page a CLIENT opens from a magic link, so stale data here is the
  // most externally visible version of the bug.
  const project = await getProjectById(id);
  if (!project) notFound();

  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });

  if (!resolution.ok) {
    // One message for every rejection. "Expired" is safe to say and
    // "that token belongs to a different engagement" is not, so rather
    // than branch and risk the wrong half leaking, the page says the
    // same civil thing and the reason lives in the database.
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          This link isn&apos;t valid
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          The tracker link from your project may have expired or been
          mistyped. Reply to the email it came from and we&apos;ll send a
          fresh one.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-brand-magentaText hover:underline"
        >
          ← $BUILD.Store home
        </Link>
      </div>
    );
  }

  // Usage signal, not a credential check, so a failed write must not
  // stop a client seeing their tracker.
  if (resolution.tokenId) {
    void touchTrackerToken(resolution.tokenId).catch(() => {});
  }

  const milestones = await safely(() => getMilestonesForProject(id), []);
  // Reader swap 2026-09-03. `milestones` above is the live table and
  // this line recomputed the same thing from the fixture, so the
  // progress bar and the milestone list underneath it were describing
  // two different projects. Derived from what is already loaded rather
  // than queried again.
  const completed = milestones.filter((m) => m.status === "completed").length;
  const progress = {
    completed,
    total: milestones.length,
    ratio: milestones.length === 0 ? 0 : completed / milestones.length,
  };
  // Freshness signal — latest milestone touch anywhere on the project.
  // Uses updatedAt since it's always populated on status changes; falls
  // back to project.updatedAt if no milestones exist yet.
  const latestMilestoneUpdate = milestones.reduce<string | null>(
    (latest, m) => {
      const t = m.updatedAt ?? m.completedAt ?? null;
      if (!t) return latest;
      if (!latest || t > latest) return t;
      return latest;
    },
    null,
  );
  const lastTouched = latestMilestoneUpdate ?? project.updatedAt ?? null;
  const percent = Math.round(progress.ratio * 100);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="text-xs uppercase tracking-wider text-brand-magentaText">
        Project tracker
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {project.title}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Where the engagement is in the delivery cycle. Milestone status
        updates as the team advances each step.
      </p>

      {/* Task #46 — headline progress strip. Percentage + count + last
          touched so the client can see the state at a glance without
          reading each milestone card. */}
      <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              Progress
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {progress.total === 0
                ? "Kickoff pending"
                : `${percent}% complete`}
            </div>
            {progress.total > 0 && (
              <div className="mt-0.5 text-xs text-ink-muted">
                {progress.completed} of {progress.total} milestones landed
              </div>
            )}
          </div>
          {lastTouched && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                Last updated
              </div>
              <div className="mt-1 text-xs text-ink">
                {new Date(lastTouched).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
          )}
        </div>
        {progress.total > 0 && (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(102, 102, 102, 0.15)" }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${percent} percent of milestones complete`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${percent}%`,
                backgroundColor: "#007048",
              }}
            />
          </div>
        )}
      </div>

      {milestones.length === 0 ? (
        <Card className="mt-8">
          <CardEyebrow>Getting started</CardEyebrow>
          <CardTitle className="mt-1 text-lg">
            Your team is scoping the milestones.
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Future Modern is working on kickoff planning. Once
            milestones are locked, they&apos;ll appear here and this
            page will start moving. You&apos;ll get an email the moment
            the first one goes live.
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-8">
            <MilestoneTracker milestones={milestones} />
          </div>

          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">
              Milestone detail
            </h2>
            <div className="mt-4 space-y-3">
              {milestones.map((m) => {
                const owner = roster.find((u) => u.id === m.ownerUserId);
                return (
                  <Card key={m.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardTitle className="text-base">{m.title}</CardTitle>
                      <span className="text-[11px] text-ink-faint">
                        {new Date(m.dueAt).toLocaleDateString()}
                      </span>
                    </div>
                    {m.description && (
                      <p className="mt-1 text-xs text-ink-muted">{m.description}</p>
                    )}
                    <p className="mt-2 text-[11px] text-ink-faint">
                      Owner: {owner ? publicName(owner) : "Unassigned"}
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}

      <p className="mt-8 text-xs text-ink-faint">
        Questions about the engagement reach us fastest as a reply to
        the most recent email thread.
      </p>
    </div>
  );
}
