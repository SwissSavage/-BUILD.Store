/**
 * Jobs — full-time / part-time / contract-to-hire postings.
 * Distinct from /contracts (one-off deliverables) and /projects (internal co-op work).
 *
 * Sources include Future Modern itself, partners (URL Media, DCG, etc.),
 * and portfolio clients who want first-look at our member pool.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_JOBS } from "@/lib/mock-data/jobs";
import { INDUSTRY_LABELS, userHasPillar, userPillars } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const TYPE_LABEL: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "contract-to-hire": "Contract-to-hire",
};

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const open = MOCK_JOBS.filter((j) => j.status === "open");
  const pillars = userPillars(user);
  const inPillar = open.filter((j) => userHasPillar(user, j.industry));
  const other = open.filter((j) => !userHasPillar(user, j.industry));

  const pillarLabel =
    pillars.length === 0
      ? "your pillar"
      : pillars.length === 1
        ? INDUSTRY_LABELS[pillars[0]]
        : `${pillars.map((p) => INDUSTRY_LABELS[p]).join(" + ")}`;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div>
        <h1 className="font-display text-4xl font-semibold">Jobs</h1>
        <p className="mt-1 text-ink-muted">
          Full-time and part-time roles from Future Modern, cooperative partners,
          and portfolio clients. First look goes to members.
        </p>
      </div>

      <Section
        title={`In ${pillarLabel}`}
        subtitle={`Closest to ${pillars.length > 1 ? "your declared pillars" : "your declared pillar"}.`}
      >
        {inPillar.length === 0 ? <Empty /> : <Grid items={inPillar} />}
      </Section>

      <Section title="Other open roles" subtitle="Cross-pillar — apply if the fit is real.">
        {other.length === 0 ? <Empty /> : <Grid items={other} />}
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Grid({ items }: { items: typeof MOCK_JOBS }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((j) => (
        <Card key={j.id}>
          <div className="flex items-center justify-between">
            <CardEyebrow>{INDUSTRY_LABELS[j.industry]}</CardEyebrow>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: "rgba(0,112,72,0.15)", color: "#007048" }}
            >
              {TYPE_LABEL[j.employmentType] ?? j.employmentType}
            </span>
          </div>
          <CardTitle className="mt-2">{j.title}</CardTitle>
          <p className="mt-3 text-sm text-ink-muted">{j.description}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {j.skillsRequired.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
              >
                {s}
              </span>
            ))}
          </div>

          <div className="mt-5 space-y-1.5 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wider text-ink-faint">Comp</span>
              <div className="font-medium">{j.compensation}</div>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>{j.location}</span>
              <span style={{ color: "#5070F0" }}>{j.postedByLabel}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
      No open roles in this cut right now.
    </div>
  );
}
