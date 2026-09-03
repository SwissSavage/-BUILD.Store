/**
 * Public client tracker — Domino's-style read-only progress view.
 *
 * Auth-free magic-link surface (clients never had a login). Sandbox
 * accepts `?token=demo` for any active contract; production swap issues
 * signed JWTs from the same service that powers /contracts/[id]/feedback.
 *
 * No PII surfaced beyond what the rest of the platform already exposes:
 * milestone titles, statuses, due dates, owner first-names via
 * publicName. No internal notes, no admin notes, no member emails.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/readers/projects";
import { getAllUsers } from "@/lib/readers/users";
import { getMilestonesForProject, safely } from "@/lib/readers";
import { projectProgress } from "@/lib/mock-data/project-milestones";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { MilestoneTracker } from "@/components/MilestoneTracker";

// Sandbox token map. Production: signed JWTs verified at the route level.
const CLIENT_TRACKER_TOKENS: Record<string, string> = {
  demo: "*",
  tok_track_p_003_marisa: "p_003",
  tok_track_p_004_devon: "p_004",
};

function tokenAuthorizesContract(token: string, contractId: string): boolean {
  const allowed = CLIENT_TRACKER_TOKENS[token];
  if (!allowed) return false;
  return allowed === "*" || allowed === contractId;
}

const CLIENT_LABELS: Record<string, string> = {
  client_url_media: "URL Media",
  client_bk_greenroots: "Brooklyn GreenRoots",
  client_arborai: "ArborAI",
};

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
  const validToken = token ? tokenAuthorizesContract(token, id) : false;
  // Reader swap 2026-08-29: was MOCK_PROJECTS/MOCK_USERS. This is the
  // page a CLIENT opens from a magic link, so stale data here is the
  // most externally visible version of the bug.
  const project = await getProjectById(id);
  if (!project) notFound();

  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });

  if (!validToken) {
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

  const milestones = await safely(() => getMilestonesForProject(id), []);
  const progress = projectProgress(id);
  const clientLabel = CLIENT_LABELS[project.clientId] ?? project.clientId;
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
        For {clientLabel}. Real-time view of where the engagement is in
        the delivery cycle. Milestone status updates automatically as the
        team advances each step.
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
            The cooperative team is working on kickoff planning. Once
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
                      Owner: {owner ? publicName(owner) : "Cooperative member"}
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}

      <p className="mt-8 text-xs text-ink-faint">
        Questions about the engagement land in your admin&apos;s inbox.
        Reply to the most recent email thread and they&apos;ll respond
        from the cooperative.
      </p>
    </div>
  );
}
