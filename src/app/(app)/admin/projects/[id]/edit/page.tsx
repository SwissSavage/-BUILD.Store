/**
 * /admin/projects/[id]/edit — fix a posted listing in place.
 *
 * Editing rather than repost-and-trash: reposting loses the id, every
 * proposal attached to it, and its position on the board. A typo in an
 * RFP should not cost the bids already submitted against it.
 *
 * Money and approval state are deliberately absent. Budget, revenue,
 * payouts, bonus gates and rfpApprovedAt have their own guarded
 * writers, and putting them on a general edit form is how a stray
 * keystroke becomes a payout change.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import { editProject } from "@/lib/project-edit-actions";
import { trashProject } from "@/lib/project-trash-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink";
const labelClass = "block text-xs text-ink-muted";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const backHref =
    project.kind === "contract" ? `/contracts/${id}` : `/projects/${id}`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href={backHref} className="text-sm text-ink-muted hover:text-ink">
        ← Back to the listing
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Edit listing</h1>
      <p className="mt-2 text-ink-muted">
        Changes are audit-logged with the before and after.
      </p>

      <Card className="mt-8">
        <CardEyebrow>{project.kind === "contract" ? "Contract" : "Initiative"}</CardEyebrow>
        <form action={editProject} className="mt-4 space-y-5">
          <input type="hidden" name="id" value={project.id} />

          <label className={labelClass}>
            Title
            <input
              name="title"
              required
              defaultValue={project.title}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Description
            <textarea
              name="description"
              rows={10}
              required
              defaultValue={project.description ?? ""}
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Pillar
              <select
                name="industry"
                required
                defaultValue={project.industry}
                className={inputClass}
              >
                <option value="stem">STEM</option>
                <option value="creative-media">Creative + media</option>
                <option value="professional-services">
                  Professional services
                </option>
              </select>
            </label>
            <label className={labelClass}>
              Status
              <select
                name="status"
                defaultValue={project.status}
                className={inputClass}
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          <label className={labelClass}>
            Skills — one per line, or comma separated
            <textarea
              name="skillsRequired"
              rows={3}
              defaultValue={(project.skillsRequired ?? []).join("\n")}
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-brand-magenta px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Save changes
          </button>
        </form>
      </Card>

      <Card className="mt-6">
        <CardTitle className="text-lg">Move to trash</CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Hides it from every board and keeps it restorable from{" "}
          <Link href="/admin/trash" className="text-brand-magenta hover:underline">
            the trash
          </Link>
          . Refuses if any payout has already been dispatched against it.
        </p>
        <form action={trashProject} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={project.id} />
          <label className={labelClass}>
            Reason (optional)
            <input
              name="reason"
              placeholder="Test listing, posted in error, duplicate…"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm hover:border-brand-magenta hover:text-brand-magenta"
          >
            Move to trash
          </button>
        </form>
      </Card>
    </div>
  );
}
