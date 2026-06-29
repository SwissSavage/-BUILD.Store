/**
 * Admin: incoming RFP vetting queue.
 *
 * Client-submitted RFPs land here with `rfpApprovedAt === null`. Admin
 * scrubs direct contact info out of the description, adjusts the public
 * title/description if needed, and approves — at which point the RFP
 * becomes visible on /contracts and members can submit quote sheets.
 *
 * Sandbox: mutates MOCK_PROJECTS in memory.
 * REPLACE WITH: Drizzle update + attribution-ledger insert on approval +
 * notification broadcast to eligible members.
 */
import { requireAdmin } from "@/lib/auth-stub";
import { revalidatePath } from "next/cache";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const ALL_INDUSTRIES: Industry[] = ["stem", "creative-media", "professional-services"];

async function approveRfp(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();
  const industry = String(formData.get("industry") ?? "") as Industry;
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;

  const p = MOCK_PROJECTS.find((x) => x.id === id);
  if (!p) return;

  if (title) p.title = title;
  if (description) p.description = description;
  if (budget) p.budget = budget;
  if (ALL_INDUSTRIES.includes(industry)) p.industry = industry;
  p.rfpAdminNote = adminNote;
  p.rfpApprovedAt = new Date().toISOString();
  p.updatedAt = new Date().toISOString();

  revalidatePath("/admin/rfps");
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

async function rejectRfp(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("adminNote") ?? "").trim() || "Declined.";

  const p = MOCK_PROJECTS.find((x) => x.id === id);
  if (!p) return;

  p.status = "cancelled";
  p.rfpAdminNote = note;
  p.updatedAt = new Date().toISOString();

  revalidatePath("/admin/rfps");
}

export default async function AdminRfpQueuePage() {
  await requireAdmin();

  const queue = MOCK_PROJECTS.filter(
    (p) =>
      p.kind === "contract" &&
      p.isRfp &&
      !p.rfpApprovedAt &&
      p.status !== "cancelled",
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">RFP intake queue</h1>
      <p className="mt-2 text-ink-muted">
        Incoming client RFPs awaiting vetting. Scrub direct contact info from
        the description before broadcasting to members. The original record is
        preserved for attribution.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4 text-sm">
        <span className="font-medium">{queue.length}</span> RFP
        {queue.length === 1 ? "" : "s"} awaiting review.
      </div>

      <section className="mt-10 space-y-6">
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            Queue is clear. New submissions land here.
          </div>
        ) : (
          queue.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="md:w-1/2">
                  <CardEyebrow>Raw · {INDUSTRY_LABELS[p.industry]}</CardEyebrow>
                  <CardTitle className="mt-2">{p.title}</CardTitle>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-ink-muted">
                    {p.description}
                  </p>
                  <div className="mt-4 text-xs text-ink-faint">
                    Client: <span className="font-mono">{p.clientId}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">
                    Budget: ${Number(p.budget).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">
                    Submitted {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="md:w-1/2 md:border-l md:border-[var(--surface-border)] md:pl-6">
                  <form action={approveRfp} className="space-y-4">
                    <input type="hidden" name="id" value={p.id} />

                    <div>
                      <CardEyebrow>Vetted copy for members</CardEyebrow>
                      <p className="mt-1 text-xs text-ink-faint">
                        Edit in place to scrub names, emails, phones, domains.
                      </p>
                    </div>

                    <label className="block">
                      <span className="text-xs uppercase tracking-wider text-ink-muted">
                        Title
                      </span>
                      <input
                        name="title"
                        defaultValue={p.title}
                        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs uppercase tracking-wider text-ink-muted">
                        Description
                      </span>
                      <textarea
                        name="description"
                        rows={5}
                        defaultValue={p.description}
                        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-ink-muted">
                          Pillar
                        </span>
                        <select
                          name="industry"
                          defaultValue={p.industry}
                          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        >
                          {ALL_INDUSTRIES.map((i) => (
                            <option key={i} value={i}>
                              {INDUSTRY_LABELS[i]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-ink-muted">
                          Budget
                        </span>
                        <input
                          name="budget"
                          defaultValue={p.budget}
                          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs uppercase tracking-wider text-ink-muted">
                        Internal note (admins only)
                      </span>
                      <textarea
                        name="adminNote"
                        rows={2}
                        defaultValue={p.rfpAdminNote ?? ""}
                        placeholder="Why you made redaction decisions, or who to notify."
                        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        className="rounded-full px-5 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: "#007048" }}
                      >
                        Approve &amp; broadcast
                      </button>
                    </div>
                  </form>

                  <form
                    action={rejectRfp}
                    className="mt-6 space-y-2 border-t border-[var(--surface-border)] pt-4"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <label className="block">
                      <span className="text-xs uppercase tracking-wider text-ink-muted">
                        Decline with note
                      </span>
                      <input
                        name="adminNote"
                        placeholder="Out of scope · wrong pillar · abuse"
                        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="text-xs"
                      style={{ color: "#E53E3E" }}
                    >
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
