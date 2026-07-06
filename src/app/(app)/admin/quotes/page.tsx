/**
 * Admin: outgoing quote-sheet approval queue.
 *
 * Member-submitted quote sheets land here with `approvedAt === null`. Admin
 * reads the raw submission (including `memberNote` — internal only) and
 * either approves (optionally with `approved*` overrides to scrub PII) so the
 * sheet is ready to be bundled into the client-facing proposal, or rejects
 * with a revision note back to the member.
 *
 * Sandbox: mutates MOCK_QUOTES in memory.
 * REPLACE WITH: Drizzle update + attribution-ledger insert on approval +
 * transactional email to the client once a proposal bundle is assembled.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { revalidatePath } from "next/cache";
import { MOCK_QUOTES } from "@/lib/mock-data/quotes";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { INDUSTRY_LABELS, adminName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

async function approveQuote(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const sheet = MOCK_QUOTES.find((q) => q.id === id);
  if (!sheet) return;

  const approvedPrice = String(formData.get("approvedPrice") ?? "").trim();
  const approvedTimeline = String(formData.get("approvedTimeline") ?? "").trim();
  const strengths = String(formData.get("strengths") ?? "").trim();
  const weaknesses = String(formData.get("weaknesses") ?? "").trim();

  // Only record a scrub override when the admin actually changed the raw
  // text. Equal to raw → null (meaning "send raw"). Keeps member edits to
  // price/timeline visible even after the first approval.
  sheet.approvedPrice =
    approvedPrice && approvedPrice !== sheet.price ? approvedPrice : null;
  sheet.approvedTimeline =
    approvedTimeline && approvedTimeline !== sheet.timeline
      ? approvedTimeline
      : null;
  // Strengths / weaknesses are admin-authored narrative — blank = not written.
  sheet.strengths = strengths || null;
  sheet.weaknesses = weaknesses || null;
  sheet.approvedAt = new Date().toISOString();
  sheet.rejectedAt = null;
  sheet.rejectionNote = null;

  revalidatePath("/admin/quotes");
  revalidatePath("/profile/quotes");
}

async function rejectQuote(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("rejectionNote") ?? "").trim() || "Needs revision.";

  const sheet = MOCK_QUOTES.find((q) => q.id === id);
  if (!sheet) return;

  sheet.approvedAt = null;
  sheet.rejectedAt = new Date().toISOString();
  sheet.rejectionNote = note;

  revalidatePath("/admin/quotes");
  revalidatePath("/profile/quotes");
}

type Filter = "pending" | "approved" | "rejected";

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: Filter }>;
}) {
  await requireAdmin();
  const { filter = "pending" } = await searchParams;

  const sheets = MOCK_QUOTES.filter((q) => {
    if (filter === "pending") return !q.approvedAt && !q.rejectedAt;
    if (filter === "approved") return Boolean(q.approvedAt);
    if (filter === "rejected") return Boolean(q.rejectedAt);
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const counts = {
    pending: MOCK_QUOTES.filter((q) => !q.approvedAt && !q.rejectedAt).length,
    approved: MOCK_QUOTES.filter((q) => q.approvedAt).length,
    rejected: MOCK_QUOTES.filter((q) => q.rejectedAt).length,
  };

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">
        Quote sheet review
      </h1>
      <p className="mt-2 text-ink-muted">
        Contributor quote sheets awaiting approval before being bundled into
        client-facing proposals. Scrub any direct-contact info inline (never
        a rejection reason) and write the strengths / weaknesses positioning
        the client will see — members don&apos;t author those.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <FilterPill active={filter === "pending"} href="?filter=pending">
          Pending · {counts.pending}
        </FilterPill>
        <FilterPill active={filter === "approved"} href="?filter=approved">
          Sent · {counts.approved}
        </FilterPill>
        <FilterPill active={filter === "rejected"} href="?filter=rejected">
          Rejected · {counts.rejected}
        </FilterPill>
      </div>

      <section className="mt-8 space-y-6">
        {sheets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            Nothing in this bucket.
          </div>
        ) : (
          sheets.map((sheet) => {
            const project = MOCK_PROJECTS.find((p) => p.id === sheet.projectId);
            const author = MOCK_USERS.find((u) => u.id === sheet.userId);
            return (
              <Card key={sheet.id}>
                <div className="flex flex-col gap-6 md:flex-row">
                  <div className="md:w-1/2">
                    <div className="flex items-center gap-2">
                      {author && <Avatar user={author} size="sm" />}
                      <div>
                        <CardEyebrow>
                          {author ? adminName(author) : "Unknown"} · Raw
                        </CardEyebrow>
                        {project && (
                          <div className="text-xs text-ink-faint">
                            {INDUSTRY_LABELS[project.industry]} · {project.title}
                          </div>
                        )}
                      </div>
                    </div>

                    <CardTitle className="mt-3 text-lg">
                      {sheet.price}
                    </CardTitle>
                    <div className="mt-1 text-sm text-ink-muted">
                      {sheet.timeline}
                    </div>

                    {sheet.workSamples.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wider text-ink-faint">
                          Work samples
                        </div>
                        <ul className="mt-1 space-y-1 text-sm">
                          {sheet.workSamples.map((s, i) => (
                            <li key={i}>
                              <span className="text-ink-muted">
                                {s.caption}:{" "}
                              </span>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all hover:underline"
                                style={{ color: "#D828A0" }}
                              >
                                {s.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sheet.memberNote && (
                      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs">
                        <div className="font-medium text-ink-muted">
                          Internal note from contributor
                        </div>
                        <div className="mt-1 text-ink-muted">
                          {sheet.memberNote}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 text-xs text-ink-faint">
                      Submitted {new Date(sheet.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="md:w-1/2 md:border-l md:border-[var(--surface-border)] md:pl-6">
                    <form action={approveQuote} className="space-y-5">
                      <input type="hidden" name="id" value={sheet.id} />

                      <div className="flex items-center justify-between">
                        <CardEyebrow>Client-facing</CardEyebrow>
                        <StatusPill sheet={sheet} />
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wider text-ink-muted">
                          PII scrub (price / timeline)
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          Edit only if the member inlined contact info. Leaving
                          equal to raw sends as-submitted.
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="block">
                            <span className="text-xs uppercase tracking-wider text-ink-muted">
                              Price
                            </span>
                            <input
                              name="approvedPrice"
                              defaultValue={sheet.approvedPrice ?? sheet.price}
                              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs uppercase tracking-wider text-ink-muted">
                              Timeline
                            </span>
                            <input
                              name="approvedTimeline"
                              defaultValue={
                                sheet.approvedTimeline ?? sheet.timeline
                              }
                              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4">
                        <div className="text-xs uppercase tracking-wider text-ink-muted">
                          Positioning narrative (admin-authored)
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          Optional but recommended. Frame the contributor for
                          the client. Members don&apos;t see this until you
                          approve.
                        </p>

                        <label className="mt-3 block">
                          <span className="text-xs uppercase tracking-wider text-ink-muted">
                            Strengths
                          </span>
                          <textarea
                            name="strengths"
                            rows={4}
                            defaultValue={sheet.strengths ?? ""}
                            placeholder="Why this contributor is a fit. Pull from their portfolio + memberNote."
                            className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="mt-3 block">
                          <span className="text-xs uppercase tracking-wider text-ink-muted">
                            Weaknesses
                          </span>
                          <textarea
                            name="weaknesses"
                            rows={3}
                            defaultValue={sheet.weaknesses ?? ""}
                            placeholder="What they'll need backup on — sets honest expectations."
                            className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          className="rounded-full px-5 py-2 text-sm font-medium text-white"
                          style={{ backgroundColor: "#007048" }}
                        >
                          {sheet.approvedAt ? "Re-approve" : "Approve"}
                        </button>
                      </div>
                    </form>

                    <form
                      action={rejectQuote}
                      className="mt-6 space-y-2 border-t border-[var(--surface-border)] pt-4"
                    >
                      <input type="hidden" name="id" value={sheet.id} />
                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-ink-muted">
                          Reject with note (member sees this)
                        </span>
                        <p className="mt-1 text-xs text-ink-faint">
                          Use only for content issues — vague pricing, off-scope,
                          abuse. Never for PII; just remove that inline above.
                        </p>
                        <input
                          name="rejectionNote"
                          defaultValue={sheet.rejectionNote ?? ""}
                          placeholder="What needs revising before we send it?"
                          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                      </label>
                      <button
                        type="submit"
                        className="text-xs"
                        style={{ color: "#E53E3E" }}
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}

function FilterPill({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-ink px-4 py-1.5 text-[var(--surface)]"
          : "rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-ink-muted hover:border-brand-magenta"
      }
    >
      {children}
    </Link>
  );
}

function StatusPill({
  sheet,
}: {
  sheet: (typeof MOCK_QUOTES)[number];
}) {
  if (sheet.approvedAt) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "rgba(0,112,72,0.15)", color: "#007048" }}
      >
        Sent
      </span>
    );
  }
  if (sheet.rejectedAt) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "rgba(229,62,62,0.15)", color: "#E53E3E" }}
      >
        Rejected
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: "rgba(80,112,240,0.15)", color: "#5070F0" }}
    >
      Pending
    </span>
  );
}
