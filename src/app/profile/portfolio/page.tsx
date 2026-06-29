/**
 * Member portfolio editor.
 *
 * Members add/edit/delete their own portfolio items. Items submit as
 * "pending review" — admins publish (optionally with scrubbed public text
 * and/or the projectUrl redacted) before they appear on public surfaces.
 *
 * Sandbox: mutates MOCK_PORTFOLIO in memory.
 * REPLACE WITH: Drizzle insert/update/delete on the portfolio_items table.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const ALL_INDUSTRIES: Industry[] = ["stem", "creative-media", "professional-services"];

async function createItem(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title required");

  const industry = String(formData.get("industry") ?? "creative-media") as Industry;
  const description = String(formData.get("description") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const projectUrl = String(formData.get("projectUrl") ?? "").trim() || null;
  const technologies = String(formData.get("technologies") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  MOCK_PORTFOLIO.push({
    id: `pf_${Date.now()}`,
    userId: user.id,
    title,
    description,
    imageUrl,
    projectUrl,
    industry,
    technologies,
    featured: false,
    createdAt: new Date().toISOString(),
    publishedAt: null, // pending admin review
    publishedTitle: null,
    publishedDescription: null,
    hideProjectUrl: false,
    rejectedAt: null,
    rejectionNote: null,
  });

  revalidatePath("/profile/portfolio");
  revalidatePath("/admin/portfolios");
}

async function deleteItem(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const id = String(formData.get("id") ?? "");
  const idx = MOCK_PORTFOLIO.findIndex((p) => p.id === id && p.userId === user.id);
  if (idx >= 0) MOCK_PORTFOLIO.splice(idx, 1);

  revalidatePath("/profile/portfolio");
  revalidatePath("/admin/portfolios");
  revalidatePath("/showcase");
  if (user.handle) revalidatePath(`/u/${user.handle}`);
}

function statusLabel(item: {
  publishedAt: string | null;
  rejectedAt: string | null;
}) {
  if (item.rejectedAt) return { text: "Rejected", color: "#E53E3E" };
  if (item.publishedAt) return { text: "Published", color: "#007048" };
  return { text: "Pending review", color: "#5070F0" };
}

export default async function PortfolioEditorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const mine = MOCK_PORTFOLIO.filter((p) => p.userId === user.id).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Your portfolio</h1>
          <p className="mt-2 text-ink-muted">
            Submit work samples. Admins review and publish — redacting client
            names, direct links, or personal branding as needed — before pieces
            appear on your public profile or the showcase.
          </p>
        </div>
        <Link
          href={`/u/${user.handle}`}
          className="shrink-0 rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta"
        >
          View public profile →
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Your submissions</h2>
        {mine.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            No submissions yet. Add your first piece below.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {mine.map((item) => {
              const status = statusLabel(item);
              const showingOverride =
                item.publishedAt &&
                (item.publishedTitle || item.publishedDescription);
              return (
                <Card key={item.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardEyebrow>{INDUSTRY_LABELS[item.industry]}</CardEyebrow>
                      <CardTitle className="mt-2">{item.title}</CardTitle>
                      {item.description && (
                        <p className="mt-2 text-sm text-ink-muted">
                          {item.description}
                        </p>
                      )}
                      {showingOverride && (
                        <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs">
                          <div className="font-medium text-ink-muted">
                            Public-view override (admin)
                          </div>
                          {item.publishedTitle && (
                            <div className="mt-1">
                              <span className="text-ink-faint">Title:</span>{" "}
                              {item.publishedTitle}
                            </div>
                          )}
                          {item.publishedDescription && (
                            <div className="mt-1">
                              <span className="text-ink-faint">Description:</span>{" "}
                              {item.publishedDescription}
                            </div>
                          )}
                          {item.hideProjectUrl && (
                            <div className="mt-1 text-ink-faint">
                              Project URL hidden on public view.
                            </div>
                          )}
                        </div>
                      )}
                      {item.rejectionNote && (
                        <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs">
                          <div className="font-medium" style={{ color: "#E53E3E" }}>
                            Admin note
                          </div>
                          <div className="mt-1 text-ink-muted">
                            {item.rejectionNote}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${status.color}26`,
                          color: status.color,
                        }}
                      >
                        {status.text}
                      </span>
                      <form action={deleteItem} className="mt-3">
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className="text-xs text-ink-faint hover:text-ink"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Card className="mt-10">
        <CardEyebrow>Add a piece</CardEyebrow>
        <form action={createItem} className="mt-4 space-y-5">
          <Field name="title" label="Title" required />

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Description
            </span>
            <textarea
              name="description"
              rows={3}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              placeholder="What did you do, what was the outcome?"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Pillar
              </span>
              <select
                name="industry"
                defaultValue={user.primaryIndustry ?? "creative-media"}
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                {ALL_INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {INDUSTRY_LABELS[i]}
                  </option>
                ))}
              </select>
            </label>
            <Field
              name="technologies"
              label="Tech / tags (comma separated)"
            />
          </div>

          <Field name="imageUrl" label="Image URL (optional)" />
          <Field name="projectUrl" label="Project URL (optional)" />

          <button
            type="submit"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#5070F0" }}
          >
            Submit for review
          </button>
          <p className="text-xs text-ink-faint">
            Goes into the admin queue. You&apos;ll see status updates here.
          </p>
        </form>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  required = false,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
      <input
        name={name}
        required={required}
        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
      />
    </label>
  );
}
