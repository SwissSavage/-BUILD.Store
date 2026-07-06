/**
 * Admin: project oversight. See all RFPs and active projects.
 * Status transitions are admin-only in v1.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { newContributionCount } from "@/lib/mock-data/prospective-contributions";
import { INDUSTRY_LABELS, type Project } from "@/lib/types";

async function advance(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const next = String(formData.get("status")) as Project["status"];
  const p = MOCK_PROJECTS.find((x) => x.id === id);
  if (p) {
    p.status = next;
    p.updatedAt = new Date().toISOString();
  }
  revalidatePath("/admin/projects");
}

const STATUSES: Project["status"][] = ["open", "in_progress", "completed", "cancelled"];

export default async function AdminProjectsPage() {
  await requireAdmin();
  const newOutsideOffers = newContributionCount();

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Projects</h1>
      <p className="mt-2 text-ink-muted">All projects across the cooperative.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/projects/applications"
          className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magenta"
        >
          Member application queue →
        </Link>
        <Link
          href="/admin/projects/contributions"
          className="inline-flex items-center gap-2 rounded-full border border-[#007048]/40 px-4 py-2 text-xs hover:border-[#007048] hover:text-[#007048]"
        >
          Outside contributor queue →
          {newOutsideOffers > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: "#007048" }}
            >
              {newOutsideOffers}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="p-4 text-left">Title</th>
              <th className="p-4 text-left">Pillar</th>
              <th className="p-4 text-left">Budget</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PROJECTS.map((p) => (
              <tr key={p.id} className="border-t border-[var(--surface-border)]">
                <td className="p-4">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-ink-muted line-clamp-1">
                    {p.description}
                  </div>
                </td>
                <td className="p-4 text-ink-muted">
                  {INDUSTRY_LABELS[p.industry]}
                </td>
                <td className="p-4">${Number(p.budget).toLocaleString()}</td>
                <td className="p-4 capitalize">{p.status.replace("_", " ")}</td>
                <td className="p-4">
                  <form action={advance} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <select
                      name="status"
                      defaultValue={p.status}
                      className="rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--surface-border)] px-2 py-1 text-xs hover:border-brand-magenta"
                    >
                      Update
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
