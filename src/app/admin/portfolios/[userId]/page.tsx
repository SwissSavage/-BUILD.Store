/**
 * Admin per-member portfolio editor — the actual PII-scrub surface.
 *
 * For every item the member submitted, admins see:
 *   - The RAW submission (what the member typed — may contain client names,
 *     personal contact info, external portfolio links).
 *   - An editable PUBLIC OVERRIDE for title and description — replaces the
 *     raw text on public surfaces without destroying the original.
 *   - A checkbox to hide the projectUrl on public views (anti-circumvention).
 *   - Publish / reject actions.
 *
 * Publishing makes the item visible on /u/[handle] and /showcase.
 * Rejecting records a note the member sees on their own editor.
 *
 * Sandbox: mutates MOCK_PORTFOLIO in memory.
 * REPLACE WITH: Drizzle updates + attribution-ledger inserts on publish.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { INDUSTRY_LABELS, adminName, userPillars } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

async function publishItem(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const publishedTitle = String(formData.get("publishedTitle") ?? "").trim();
  const publishedDescription = String(formData.get("publishedDescription") ?? "").trim();
  const hideProjectUrl = formData.get("hideProjectUrl") === "on";

  const item = MOCK_PORTFOLIO.find((p) => p.id === id);
  if (!item) return;

  item.publishedAt = new Date().toISOString();
  item.rejectedAt = null;
  item.rejectionNote = null;
  // Only store overrides when the admin actually changed the text; null means
  // "use member's raw value" so edits in the future stay visible.
  item.publishedTitle =
    publishedTitle && publishedTitle !== item.title ? publishedTitle : null;
  item.publishedDescription =
    publishedDescription && publishedDescription !== (item.description ?? "")
      ? publishedDescription
      : null;
  item.hideProjectUrl = hideProjectUrl;

  revalidatePath("/admin/portfolios");
  revalidatePath(`/admin/portfolios/${userId}`);
  revalidatePath("/showcase");
  const u = MOCK_USERS.find((x) => x.id === userId);
  if (u) revalidatePath(`/u/${u.handle}`);
  revalidatePath("/profile/portfolio");
}

async function unpublishItem(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const item = MOCK_PORTFOLIO.find((p) => p.id === id);
  if (item) {
    item.publishedAt = null;
    item.publishedTitle = null;
    item.publishedDescription = null;
    item.hideProjectUrl = false;
  }

  revalidatePath("/admin/portfolios");
  revalidatePath(`/admin/portfolios/${userId}`);
  revalidatePath("/showcase");
  const u = MOCK_USERS.find((x) => x.id === userId);
  if (u) revalidatePath(`/u/${u.handle}`);
  revalidatePath("/profile/portfolio");
}

async function rejectItem(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const note = String(formData.get("rejectionNote") ?? "").trim() || "Needs revision.";

  const item = MOCK_PORTFOLIO.find((p) => p.id === id);
  if (item) {
    item.publishedAt = null;
    item.rejectedAt = new Date().toISOString();
    item.rejectionNote = note;
  }

  revalidatePath(`/admin/portfolios/${userId}`);
  revalidatePath("/profile/portfolio");
}

export default async function AdminMemberPortfolioPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;

  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) notFound();

  const items = MOCK_PORTFOLIO
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pillars = userPillars(user);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link
        href="/admin/portfolios"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← All members
      </Link>

      <header className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar user={user} size="lg" />
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {adminName(user)}
            </h1>
            <div className="mt-1 text-sm text-ink-muted">
              {user.email}
              {pillars.length > 0 &&
                ` · ${pillars.map((p) => INDUSTRY_LABELS[p]).join(" + ")}`}
            </div>
          </div>
        </div>
        <Link
          href={`/u/${user.handle}`}
          className="self-start rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta"
          target="_blank"
          rel="noreferrer"
        >
          View public profile →
        </Link>
      </header>

      <section className="mt-10 space-y-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            No portfolio submissions from this member.
          </div>
        ) : (
          items.map((item) => {
            const isPublished = Boolean(item.publishedAt);
            const isRejected = Boolean(item.rejectedAt);
            return (
              <Card key={item.id}>
                <div className="flex flex-col gap-6 md:flex-row">
                  <div className="md:w-1/2">
                    <CardEyebrow>
                      Raw · {INDUSTRY_LABELS[item.industry]}
                    </CardEyebrow>
                    <CardTitle className="mt-2">{item.title}</CardTitle>
                    <p className="mt-3 text-sm text-ink-muted whitespace-pre-wrap">
                      {item.description ?? "—"}
                    </p>
                    {item.projectUrl && (
                      <p className="mt-3 text-xs">
                        <span className="text-ink-faint">Project URL: </span>
                        <span className="break-all">{item.projectUrl}</span>
                      </p>
                    )}
                    {item.imageUrl && (
                      <p className="mt-1 text-xs">
                        <span className="text-ink-faint">Image URL: </span>
                        <span className="break-all">{item.imageUrl}</span>
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.technologies.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 text-xs text-ink-faint">
                      Submitted {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="md:w-1/2 md:border-l md:border-[var(--surface-border)] md:pl-6">
                    <form action={publishItem} className="space-y-4">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="userId" value={user.id} />

                      <div>
                        <div className="flex items-center justify-between">
                          <CardEyebrow>Public override</CardEyebrow>
                          {isPublished && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: "rgba(0,112,72,0.15)",
                                color: "#007048",
                              }}
                            >
                              Published
                            </span>
                          )}
                          {isRejected && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: "rgba(229,62,62,0.15)",
                                color: "#E53E3E",
                              }}
                            >
                              Rejected
                            </span>
                          )}
                          {!isPublished && !isRejected && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: "rgba(80,112,240,0.15)",
                                color: "#5070F0",
                              }}
                            >
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          Leave blank to publish the raw text. Override to scrub
                          client names, PII, or personal branding.
                        </p>
                      </div>

                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-ink-muted">
                          Public title
                        </span>
                        <input
                          name="publishedTitle"
                          defaultValue={item.publishedTitle ?? item.title}
                          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-ink-muted">
                          Public description
                        </span>
                        <textarea
                          name="publishedDescription"
                          rows={4}
                          defaultValue={
                            item.publishedDescription ?? item.description ?? ""
                          }
                          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                      </label>

                      {item.projectUrl && (
                        <label className="flex items-start gap-2 rounded-lg border border-[var(--surface-border)] p-3">
                          <input
                            type="checkbox"
                            name="hideProjectUrl"
                            defaultChecked={item.hideProjectUrl}
                            className="mt-0.5 h-4 w-4"
                          />
                          <div className="text-xs">
                            <div className="font-medium">
                              Hide project URL on public view
                            </div>
                            <div className="text-ink-faint">
                              Anti-circumvention. The URL stays on record for
                              attribution but clients can&apos;t route off-platform.
                            </div>
                          </div>
                        </label>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          className="rounded-full px-5 py-2 text-sm font-medium text-white"
                          style={{ backgroundColor: "#007048" }}
                        >
                          {isPublished ? "Re-publish" : "Publish"}
                        </button>
                      </div>
                    </form>

                    {isPublished && (
                      <form action={unpublishItem} className="mt-3">
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          className="text-xs text-ink-muted hover:text-ink"
                        >
                          Unpublish
                        </button>
                      </form>
                    )}

                    <form action={rejectItem} className="mt-6 space-y-2 border-t border-[var(--surface-border)] pt-4">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="userId" value={user.id} />
                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-ink-muted">
                          Reject with note
                        </span>
                        <input
                          name="rejectionNote"
                          defaultValue={item.rejectionNote ?? ""}
                          placeholder="What should the member revise?"
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
