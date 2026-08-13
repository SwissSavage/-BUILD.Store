/**
 * Admin: incoming RFP vetting queue.
 *
 * Client-submitted RFPs land here with `rfpApprovedAt === null`. Admin
 * scrubs direct contact info out of the description, adjusts the public
 * title/description if needed, and approves — at which point the RFP
 * becomes visible on /contracts and members can submit quote sheets.
 *
 * SANDBOX→LIVE swap history:
 *   - Pre-Beta cutover: mutated MOCK_PROJECTS in memory.
 *   - Beta cutover (this file, 2026-08-13): swapped to Drizzle. Queue
 *     read via db.select with WHERE conditions; approve + reject use
 *     db.update against the projects table.
 */
import { requireAdmin } from "@/lib/auth-stub";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
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

  if (!id) return;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    rfpAdminNote: adminNote,
    rfpApprovedAt: now,
    updatedAt: now,
  };
  if (title) patch.title = title;
  if (description) patch.description = description;
  if (budget) patch.budget = budget;
  if (ALL_INDUSTRIES.includes(industry)) patch.industry = industry;

  await db.update(projects).set(patch).where(eq(projects.id, id));

  revalidatePath("/admin/rfps");
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

async function rejectRfp(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("adminNote") ?? "").trim() || "Declined.";
  if (!id) return;

  await db
    .update(projects)
    .set({
      status: "cancelled",
      rfpAdminNote: note,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(projects.id, id));

  revalidatePath("/admin/rfps");
}

export default async function AdminRfpQueuePage() {
  await requireAdmin();

  const queue = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.kind, "contract"),
        eq(projects.isRfp, true),
        isNull(projects.rfpApprovedAt),
        ne(projects.status, "cancelled"),
      ),
    )
    .orderBy(desc(projects.createdAt));

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
