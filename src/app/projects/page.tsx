/**
 * Projects — INTERNAL cooperative contributions.
 * Members browse and opt into initiatives owned by Future Modern / $BUILD.Store
 * itself. Compensation is $BUILD tokens + reputation, not client invoices.
 *
 * Public posture (Phase 2.8): logged-out visitors arriving from
 * /whitelist Path 3 ("contribute to a project") can browse + click
 * through to /projects/[id], where they get a public "Offer to help"
 * form scoped to that project. The member apply form is still
 * authenticated and lives on the same detail page.
 *
 * For external one-off client work, see /contracts.
 */
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { INDUSTRY_LABELS } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { NotificationStrip } from "@/components/NotificationStrip";

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  const internal = MOCK_PROJECTS.filter((p) => p.kind === "internal");

  const openHere = internal.filter((p) => p.status === "open");
  const active = internal.filter((p) => p.status === "in_progress");
  const myContribs = user
    ? internal.filter((p) => p.assignedMemberIds.includes(user.id))
    : [];

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Venture Labor</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Members buy in with skill and time, not capital. The cap
            table is the contributor sheet. Profit splits are the
            agreement, not the ask.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Help wanted on Future Modern and $BUILD.Store itself.
            Contributor tokens, not client invoices.
          </p>
        </div>
        {user && (
          <Link
            href="/projects/new"
            className="self-start rounded-full px-6 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#5070F0" }}
          >
            Propose an initiative
          </Link>
        )}
      </div>

      {!user && (
        <Card className="mt-6 border-[#007048]/40">
          <CardEyebrow>Outside the cooperative? You can still help.</CardEyebrow>
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">
            Path 3 from the whitelist lands here. Pick an open initiative
            below, open it, and use the "Offer to help" form on the
            project page. No account required to send the offer — just
            tell us how you'd contribute and admin will follow up by
            email. Standing in the cooperative is still earned the same
            way it is for everyone else (see{" "}
            <Link
              href="/whitelist"
              className="text-brand-magenta hover:underline"
            >
              /whitelist
            </Link>
            ); this just opens the door for a single project.
          </p>
        </Card>
      )}

      {user && (
        <NotificationStrip
          userId={user.id}
          kinds={["project_application", "project_application_decision"]}
          surfaceLabel="Projects"
        />
      )}

      {myContribs.length > 0 && (
        <Section title="Your contributions">
          <Grid items={myContribs} />
        </Section>
      )}

      <Section
        title="Open for contribution"
        subtitle={
          user
            ? "Pick up a thread — no bidding, just opt in."
            : "Pick a project. The next page has an 'Offer to help' form for outside contributors."
        }
      >
        {openHere.length === 0 ? <Empty /> : <Grid items={openHere} />}
      </Section>

      <Section
        title="In progress"
        subtitle={
          user
            ? "Initiatives already under way. See who's on it or join an existing crew."
            : "Already under way — outside contributors can still offer to pair on these."
        }
      >
        {active.length === 0 ? <Empty /> : <Grid items={active} />}
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

function Grid({ items }: { items: typeof MOCK_PROJECTS }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="block transition-transform hover:-translate-y-0.5"
        >
          <Card className="h-full transition-colors hover:border-brand-magenta/40">
            <CardEyebrow>{INDUSTRY_LABELS[p.industry]}</CardEyebrow>
            <CardTitle className="mt-2">{p.title}</CardTitle>
            <p className="mt-3 text-sm text-ink-muted">{p.description}</p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.skillsRequired.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
                >
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                style={{ backgroundColor: "rgba(80,112,240,0.15)", color: "#5070F0" }}
              >
                {p.status.replace("_", " ")}
              </span>
              <span className="text-xs text-ink-muted">
                {p.assignedMemberIds.length > 0
                  ? `${p.assignedMemberIds.length} contributor${p.assignedMemberIds.length === 1 ? "" : "s"}`
                  : "Help wanted"}
              </span>
            </div>
            <div className="mt-3 text-xs text-brand-magenta">
              View project →
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
      Nothing open right now. Check back, or propose one.
    </div>
  );
}
