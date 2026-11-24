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
import { PostListingButton } from "@/components/PostListingButton";
import { getCurrentUser } from "@/lib/auth-stub";
import { getAllProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { INDUSTRY_LABELS, type Project } from "@/lib/types";
import { briefSummary } from "@/components/Brief";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { ListingCard, ListingTags } from "@/components/ListingCard";
import { NotificationStrip } from "@/components/NotificationStrip";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  // Reader swap 2026-08-29: was MOCK_PROJECTS, so an initiative a
  // member proposed through /projects/new saved to Postgres and then
  // never appeared on the board it was supposed to land on.
  const { projects } = await safely(() => getAllProjects(), {
    projects: [],
    source: "postgres" as const,
  });
  const internal = projects.filter((p) => p.kind === "internal");

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

      {/*
        Two ways forward, never a dead end. Before 2026-11-13 the
        middleware matcher bounced every signed-out visitor to /signin,
        so this branch had never rendered and the only thing a visitor
        saw was a sign-in form telling them to go find whoever
        introduced them. Jamar: "There should be two options, sign in
        or apply to join."

        Sign in carries ?next so a member who was simply logged out
        lands back here instead of on /dashboard.
      */}
      {!user && (
        <Card className="mt-6 border-[#007048]/40">
          <CardEyebrow>Outside the cooperative? You can still help.</CardEyebrow>
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">
            Pick an open initiative below, open it, and use the
            &ldquo;Offer to help&rdquo; form on the project page. No
            account required to send the offer — tell us how you&apos;d
            contribute and admin follows up by email.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/signin?next=/projects"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: "#5070F0" }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-[var(--surface-border)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand-magenta"
            >
              Apply to join
            </Link>
          </div>
          <p className="mt-4 max-w-3xl text-xs text-ink-faint">
            Already a member? Sign in. Otherwise apply with your work —
            standing is earned the same way for everyone, which{" "}
            <Link
              href="/whitelist"
              className="text-brand-magentaText hover:underline"
            >
              /whitelist
            </Link>{" "}
            lays out in full. Offering help on one project does not
            require either.
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

function Grid({ items }: { items: Project[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <ListingCard
          key={p.id}
          href={`/projects/${p.id}`}
          imageUrl={p.featuredImageUrl}
          fallbackLabel={INDUSTRY_LABELS[p.industry]}
          footer={
            <>
              <div className="flex items-center justify-between">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                  style={{ backgroundColor: "rgba(80,112,240,0.15)", color: "var(--fm-blue-text)" }}
                >
                  {p.status.replace("_", " ")}
                </span>
                <span className="text-xs text-ink-muted">
                  {p.assignedMemberIds.length > 0
                    ? `${p.assignedMemberIds.length} contributor${p.assignedMemberIds.length === 1 ? "" : "s"}`
                    : "Help wanted"}
                </span>
              </div>
              <div className="mt-3 text-xs text-brand-magentaText">
                View project →
              </div>
            </>
          }
        >
          <CardEyebrow>{INDUSTRY_LABELS[p.industry]}</CardEyebrow>
          <CardTitle className="mt-2 line-clamp-2">{p.title}</CardTitle>
          <p className="mt-3 line-clamp-3 text-sm text-ink-muted">
            {briefSummary(p.description, { skipTitle: p.title })}
          </p>
          <ListingTags tags={p.skillsRequired} />
        </ListingCard>
      ))}
    </div>
  );
}

async function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
      Nothing open right now. Check back, or propose one.
      <PostListingButton
        href="/admin/contracts/new"
        label="Post an initiative"
        hint="Admins post directly — members propose via /projects/new."
        standalone
      />
    </div>
  );
}
