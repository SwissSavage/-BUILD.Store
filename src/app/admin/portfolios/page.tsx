/**
 * Admin: portfolio review queue.
 *
 * Lists members who have submissions — both pending and published — so admins
 * can drill into each one and run the PII-scrub / redaction flow.
 *
 * Drill-down lives at /admin/portfolios/[userId].
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { INDUSTRY_LABELS, userPillars, adminName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

export default async function AdminPortfoliosPage() {
  await requireAdmin();

  const perMember = MOCK_USERS.map((u) => {
    const items = MOCK_PORTFOLIO.filter((p) => p.userId === u.id);
    const pending = items.filter((p) => !p.publishedAt && !p.rejectedAt).length;
    const published = items.filter((p) => p.publishedAt).length;
    const redacted = items.filter(
      (p) =>
        p.publishedAt &&
        (p.publishedTitle || p.publishedDescription || p.hideProjectUrl),
    ).length;
    return { user: u, total: items.length, pending, published, redacted };
  })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.pending - a.pending || b.total - a.total);

  const totalPending = perMember.reduce((sum, r) => sum + r.pending, 0);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div>
        <h1 className="font-display text-4xl font-semibold">Portfolio review</h1>
        <p className="mt-2 text-ink-muted">
          Admin-side PII scrub + anti-circumvention layer. Review members&apos;
          submissions, override public text where personal branding or direct
          contact leaks through, and toggle project-URL redaction where clients
          would otherwise route off-platform.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4 text-sm">
        <span className="font-medium">{totalPending}</span> items awaiting review
        across <span className="font-medium">{perMember.length}</span> members.
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Members</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {perMember.map((row) => {
            const pillars = userPillars(row.user);
            return (
              <Link
                key={row.user.id}
                href={`/admin/portfolios/${row.user.id}`}
                className="block"
              >
                <Card className="transition-colors hover:border-brand-magenta">
                  <div className="flex items-start gap-3">
                    <Avatar user={row.user} size="md" />
                    <div className="flex-1">
                      <CardEyebrow>
                        {pillars.map((p) => INDUSTRY_LABELS[p]).join(" + ") ||
                          "No pillar"}
                      </CardEyebrow>
                      <CardTitle className="mt-1">
                        {adminName(row.user)}
                      </CardTitle>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {row.pending > 0 && (
                          <span
                            className="rounded-full px-2 py-0.5 font-medium"
                            style={{
                              backgroundColor: "rgba(80,112,240,0.15)",
                              color: "#5070F0",
                            }}
                          >
                            {row.pending} pending
                          </span>
                        )}
                        <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                          {row.published} published
                        </span>
                        {row.redacted > 0 && (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              backgroundColor: "rgba(216,40,160,0.15)",
                              color: "#D828A0",
                            }}
                            title="Published items where admin overrode text or hid the project URL"
                          >
                            {row.redacted} redacted
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
