/**
 * Member quote-sheet tracker.
 *
 * Lists every quote the signed-in contributor has submitted, grouped by
 * status (pending admin / approved-and-sent / rejected). If the admin
 * approved with overrides, the member sees what the client actually received
 * — transparency into the redaction layer.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_QUOTES } from "@/lib/mock-data/quotes";
import { clientQuoteView } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function ProfileQuotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const mine = MOCK_QUOTES.filter((q) => q.userId === user.id).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );

  const pending = mine.filter((q) => !q.approvedAt && !q.rejectedAt);
  const approved = mine.filter((q) => q.approvedAt);
  const rejected = mine.filter((q) => q.rejectedAt);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profile"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Your profile
      </Link>

      <h1 className="mt-4 font-display text-4xl font-semibold">
        Your quote sheets
      </h1>
      <p className="mt-2 text-ink-muted">
        Structured responses you&apos;ve submitted to open RFPs. Admins scrub
        any direct-contact info before the client sees each one.
      </p>

      <Section title={`Pending review (${pending.length})`}>
        {pending.length === 0 ? (
          <Empty>Nothing waiting on admin review.</Empty>
        ) : (
          <div className="space-y-3">
            {pending.map((q) => (
              <QuoteRow key={q.id} sheet={q} />
            ))}
          </div>
        )}
      </Section>

      <Section title={`Sent to client (${approved.length})`}>
        {approved.length === 0 ? (
          <Empty>No quotes have been forwarded to clients yet.</Empty>
        ) : (
          <div className="space-y-3">
            {approved.map((q) => (
              <QuoteRow key={q.id} sheet={q} showOverrides />
            ))}
          </div>
        )}
      </Section>

      {rejected.length > 0 && (
        <Section title={`Needs revision (${rejected.length})`}>
          <div className="space-y-3">
            {rejected.map((q) => (
              <QuoteRow key={q.id} sheet={q} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-6 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

function QuoteRow({
  sheet,
  showOverrides = false,
}: {
  sheet: (typeof MOCK_QUOTES)[number];
  showOverrides?: boolean;
}) {
  const project = MOCK_PROJECTS.find((p) => p.id === sheet.projectId);
  const clientView = showOverrides ? clientQuoteView(sheet) : null;
  const priceScrubbed = Boolean(sheet.approvedPrice);
  const timelineScrubbed = Boolean(sheet.approvedTimeline);
  const hasNarrative = Boolean(sheet.strengths || sheet.weaknesses);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardEyebrow>{project?.title ?? "Unknown RFP"}</CardEyebrow>
          <CardTitle className="mt-1 truncate text-lg">
            {sheet.price} · {sheet.timeline}
          </CardTitle>
          {sheet.workSamples.length > 0 && (
            <p className="mt-2 text-xs text-ink-faint">
              {sheet.workSamples.length} work sample
              {sheet.workSamples.length === 1 ? "" : "s"} attached
            </p>
          )}

          {showOverrides && clientView && (priceScrubbed || timelineScrubbed || hasNarrative) && (
            <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs">
              <div className="font-medium text-ink-muted">
                What the client received
              </div>
              {priceScrubbed && (
                <div className="mt-1">
                  <span className="text-ink-faint">Price (admin-scrubbed):</span>{" "}
                  {clientView.price}
                </div>
              )}
              {timelineScrubbed && (
                <div className="mt-1">
                  <span className="text-ink-faint">Timeline (admin-scrubbed):</span>{" "}
                  {clientView.timeline}
                </div>
              )}
              {clientView.strengths && (
                <div className="mt-1">
                  <span className="text-ink-faint">Strengths (admin):</span>{" "}
                  {clientView.strengths}
                </div>
              )}
              {clientView.weaknesses && (
                <div className="mt-1">
                  <span className="text-ink-faint">Weaknesses (admin):</span>{" "}
                  {clientView.weaknesses}
                </div>
              )}
            </div>
          )}

          {sheet.rejectionNote && (
            <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs">
              <div className="font-medium" style={{ color: "#E53E3E" }}>
                Admin note
              </div>
              <div className="mt-1 text-ink-muted">{sheet.rejectionNote}</div>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-ink-faint">
            {new Date(sheet.createdAt).toLocaleDateString()}
          </div>
          {project && (
            <Link
              href={`/contracts/${project.id}/quote`}
              className="mt-2 block text-xs hover:underline"
              style={{ color: "#D828A0" }}
            >
              View RFP →
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
