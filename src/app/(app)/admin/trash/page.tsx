/**
 * /admin/trash — restore or permanently remove deleted projects.
 *
 * Deletion elsewhere in the app is soft: the row keeps existing and
 * drops off every surface. This is where it can be undone, and the
 * only place it can be made permanent.
 *
 * Rows sort by how close they are to auto-purge, so whatever is about
 * to disappear is what you see first.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";
import { getDeletedProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { purgeProject, restoreProject } from "@/lib/project-trash-actions";
import { RETENTION_DAYS } from "@/lib/trash-retention";
import { adminName, INDUSTRY_LABELS } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

function daysLeft(deletedAt: string): number {
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  const left = RETENTION_DAYS - Math.floor(elapsed / 86_400_000);
  return Math.max(0, left);
}

export default async function AdminTrashPage() {
  await requireAdmin();

  const [projects, { users: roster }] = await Promise.all([
    safely(() => getDeletedProjects(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const userById = new Map(roster.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Trash</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Deleted projects stay here for {RETENTION_DAYS} days and can be
        restored at any point in that window. After it, the daily sweep
        removes them along with their applications and milestones.
      </p>

      {projects.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--surface-border)] p-10 text-center text-sm text-ink-muted">
          Trash is empty.
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {projects.map((p) => {
            const left = daysLeft(p.deletedAt!);
            const deletedBy = p.deletedByUserId
              ? userById.get(p.deletedByUserId)
              : null;
            const urgent = left <= 5;

            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <CardEyebrow>
                      {INDUSTRY_LABELS[p.industry]} · {p.kind}
                    </CardEyebrow>
                    <CardTitle className="mt-1 text-lg">{p.title}</CardTitle>
                    <p className="mt-1 text-xs text-ink-muted">
                      Deleted{" "}
                      {new Date(p.deletedAt!).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {deletedBy && ` by ${adminName(deletedBy)}`}
                    </p>
                    {p.deleteReason && (
                      <p className="mt-2 text-sm italic text-ink-muted">
                        &ldquo;{p.deleteReason}&rdquo;
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                    style={{
                      color: urgent ? "#D828A0" : "#A3A3A3",
                      border: `1px solid ${urgent ? "#D828A0" : "#A3A3A3"}`,
                    }}
                  >
                    {left === 0
                      ? "purges on next sweep"
                      : `${left} day${left === 1 ? "" : "s"} left`}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-start gap-3">
                  <form action={restoreProject}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-brand-green px-4 py-2 text-xs font-medium text-brand-white hover:opacity-90"
                    >
                      Restore
                    </button>
                  </form>

                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-xs text-ink-faint hover:text-brand-magentaText">
                      Delete permanently
                    </summary>
                    <form
                      action={purgeProject}
                      className="mt-3 max-w-md space-y-2"
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <p className="text-xs text-ink-muted">
                        This removes the project, its applications and its
                        milestones. There is no undo. Type{" "}
                        <strong className="text-ink">{p.title}</strong> to
                        confirm.
                      </p>
                      <input
                        name="confirm"
                        required
                        placeholder={p.title}
                        className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-brand-magenta px-4 py-1.5 text-xs text-brand-magentaText hover:bg-brand-magenta hover:text-black"
                      >
                        Permanently delete
                      </button>
                    </form>
                  </details>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
