/**
 * Member dashboard. The first thing a signed-in user sees.
 *
 * Shows:
 *   - greeting + tier
 *   - $BUILD balance snapshot (wallet stub)
 *   - open RFPs matching the member's industry
 *   - recent activity
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";
import { getBalance, getTransactions } from "@/lib/wallet-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { applicationsByUser } from "@/lib/mock-data/project-applications";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_SELLER_APPLICATIONS } from "@/lib/mock-data/seller-applications";
import {
  notificationsForUser,
  unreadNotificationCount,
} from "@/lib/mock-data/notifications";
import {
  INDUSTRY_LABELS,
  NOTIFICATION_KIND_LABELS,
  PROJECT_APPLICATION_STATUS_LABELS,
  userHasPillar,
  userPillars,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Avatar } from "@/components/Avatar";
import { HubspotStageBadge } from "@/components/HubspotStageBadge";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import {
  completedStepIds,
  stepsForUser,
} from "@/lib/mock-data/walkthroughs";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const balance = getBalance(user.id);
  const recentTx = getTransactions(user.id).slice(0, 3);
  const pillars = userPillars(user);

  // Walkthrough resume state — only render if the user has tier-relevant
  // steps and hasn't finished them all. Viewers don't get a walkthrough.
  const walkthroughSteps =
    user.membershipTier === "viewer"
      ? []
      : stepsForUser(user.membershipTier, pillars);
  const walkthroughDone = completedStepIds(user.id);
  const walkthroughTotal = walkthroughSteps.length;
  const walkthroughDoneCount = walkthroughSteps.filter((s) =>
    walkthroughDone.has(s.id),
  ).length;
  const showWalkthroughCallout =
    walkthroughTotal > 0 && walkthroughDoneCount < walkthroughTotal;
  const openMatching = MOCK_PROJECTS.filter(
    (p) =>
      p.kind === "contract" &&
      p.isRfp &&
      p.status === "open" &&
      p.rfpApprovedAt &&
      userHasPillar(user, p.industry),
  );
  // Contracts the member is actually on — surfaces the HubSpot funnel stage
  // so they know where the client is without needing to ping admin.
  const myContracts = MOCK_PROJECTS.filter(
    (p) =>
      p.kind === "contract" &&
      p.assignedMemberIds.includes(user.id) &&
      p.status !== "completed",
  );
  // Project applications the member has submitted — gives them a single
  // place to track pending pitches without needing to remember which
  // project they applied to.
  const myApplications = applicationsByUser(user.id);
  const activeApplications = myApplications.filter(
    (a) => a.status === "pending" || a.status === "approved",
  );
  // Inbox preview — top 3 unread surfaces inline so the dashboard
  // doubles as the daily check-in instead of routing through Nav.
  const inboxUnreadCount = unreadNotificationCount(user.id);
  const inboxPreview = notificationsForUser(user.id)
    .filter((n) => n.readAt === null)
    .slice(0, 3);

  // Seller fulfillment alert — only renders for approved sellers with
  // orders waiting on them. Prominent because miss-shipping a placed
  // order is the highest-cost failure mode for a marketplace member.
  const isApprovedSeller = MOCK_SELLER_APPLICATIONS.some(
    (a) => a.userId === user.id && a.status === "approved",
  );
  const sellerOrders = isApprovedSeller
    ? MOCK_ORDERS.filter((o) => o.sellerId === user.id)
    : [];
  const actionableSellerOrders = sellerOrders.filter(
    (o) =>
      o.status === "placed" || o.status === "paid" || o.status === "fulfilling",
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-4">
          <Avatar user={user} size="xl" />
          <div>
            <p className="text-sm text-ink-muted">Welcome back,</p>
            <h1 className="font-display text-4xl font-semibold md:text-5xl">
              {user.firstName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TierBadge tier={user.membershipTier} />
              {pillars.map((p, idx) => (
                <span
                  key={p}
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    idx === 0
                      ? "bg-[var(--surface-inset)] text-ink"
                      : "border border-[var(--surface-border)] text-ink-muted"
                  }`}
                  title={idx === 0 ? "Primary pillar" : "Secondary pillar"}
                >
                  {INDUSTRY_LABELS[p]}
                  {idx === 0 && pillars.length > 1 ? " (primary)" : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Link
          href="/contracts/new"
          className="self-start rounded-full px-6 py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Submit an RFP
        </Link>
      </div>

      {showWalkthroughCallout && (
        <div
          className="mt-8 flex flex-col gap-3 rounded-2xl border p-5 text-sm md:flex-row md:items-center md:justify-between"
          style={{
            borderColor: "rgba(216, 40, 160, 0.35)",
            backgroundColor: "rgba(216, 40, 160, 0.06)",
          }}
        >
          <div>
            <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
              Beta walkthrough
            </p>
            <p className="mt-1 font-medium">
              {walkthroughDoneCount === 0
                ? "Take the guided tour — we built it for you."
                : `Resume your tour — ${walkthroughDoneCount} of ${walkthroughTotal} steps done.`}
            </p>
          </div>
          <Link
            href="/walkthrough"
            className="self-start rounded-full px-4 py-2 text-xs font-medium text-white md:self-auto"
            style={{ backgroundColor: "#D828A0" }}
          >
            {walkthroughDoneCount === 0 ? "Start the tour" : "Resume the tour"}
          </Link>
        </div>
      )}

      {actionableSellerOrders.length > 0 && (
        <section className="mt-8">
          <div
            className="flex flex-col gap-3 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between"
            style={{
              borderColor: "rgba(216, 40, 160, 0.45)",
              background:
                "linear-gradient(135deg, rgba(216,40,160,0.10), rgba(80,112,240,0.06))",
            }}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
                Marketplace fulfillment
              </p>
              <p className="mt-1 font-display text-xl font-semibold">
                {actionableSellerOrders.length}{" "}
                {actionableSellerOrders.length === 1 ? "order" : "orders"} need
                you
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Placed, paid, or fulfilling — buyers are watching for status.
              </p>
            </div>
            <Link
              href="/profile/seller/orders"
              className="self-start rounded-full px-5 py-2.5 text-sm font-medium text-white md:self-auto"
              style={{ backgroundColor: "#D828A0" }}
            >
              Open fulfillment dashboard →
            </Link>
          </div>
        </section>
      )}

      {inboxUnreadCount > 0 && (
        <section className="mt-8">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <CardEyebrow>Inbox</CardEyebrow>
                <p className="mt-1 font-display text-2xl font-semibold">
                  {inboxUnreadCount} unread{" "}
                  {inboxUnreadCount === 1 ? "item" : "items"}
                </p>
              </div>
              <Link
                href="/notifications"
                className="text-xs text-brand-magenta hover:underline"
              >
                Open inbox →
              </Link>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {inboxPreview.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start justify-between gap-3 border-t border-[var(--surface-border)] pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-wider text-brand-magenta mr-2">
                      {NOTIFICATION_KIND_LABELS[n.kind]}
                    </span>
                    <span className="text-ink">{n.title}</span>
                    <p className="text-xs text-ink-muted line-clamp-1">
                      {n.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardEyebrow>$BUILD balance</CardEyebrow>
          <div className="mt-2 font-display text-4xl font-semibold">
            {Number(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-xs text-ink-faint">$BUILD tokens</p>
          <Link
            href="/wallet"
            className="mt-4 inline-block text-sm text-brand-magenta hover:underline"
          >
            Open wallet →
          </Link>
        </Card>

        <Card>
          <CardEyebrow>Open RFPs for you</CardEyebrow>
          <CardTitle className="mt-2">
            {openMatching.length}{" "}
            {pillars.length === 0
              ? "in your pillar"
              : pillars.length === 1
                ? `in ${INDUSTRY_LABELS[pillars[0]]}`
                : `across ${pillars.length} pillars`}
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Skill-filtered RFPs matching{" "}
            {pillars.length > 1 ? "your pillars" : "your pillar"}.
          </p>
          <Link
            href="/contracts"
            className="mt-4 inline-block text-sm hover:underline"
            style={{ color: "#D828A0" }}
          >
            Browse all contracts →
          </Link>
        </Card>

        <Card>
          <CardEyebrow>Membership</CardEyebrow>
          <CardTitle className="mt-2">Tier progression</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            You&apos;re a {user.membershipTier}. See what&apos;s next.
          </p>
          <Link
            href="/membership"
            className="mt-4 inline-block text-sm text-brand-magenta hover:underline"
          >
            View tiers →
          </Link>
        </Card>
      </div>

      {myContracts.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">Your active contracts</h2>
            <span className="text-xs text-ink-faint">
              Stage chips mirror the live HubSpot deal — synced via webhook.
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {myContracts.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardEyebrow>{INDUSTRY_LABELS[p.industry]}</CardEyebrow>
                    <CardTitle className="mt-1 truncate">{p.title}</CardTitle>
                    <p className="mt-2 text-sm text-ink-muted line-clamp-2">
                      {p.description}
                    </p>
                  </div>
                  <HubspotStageBadge stage={p.hubspotStage} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-ink-faint">
                  <span>Budget · ${Number(p.budget).toLocaleString()}</span>
                  <Link
                    href="/contracts"
                    className="hover:underline"
                    style={{ color: "#D828A0" }}
                  >
                    Open contract →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {activeApplications.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">
              Your project applications
            </h2>
            <Link
              href="/projects"
              className="text-xs text-brand-magenta hover:underline"
            >
              Browse more →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeApplications.map((a) => {
              const project = MOCK_PROJECTS.find((p) => p.id === a.projectId);
              if (!project) return null;
              const accent =
                a.status === "approved" ? "#007048" : "#5070F0";
              return (
                <Link
                  key={a.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 transition-colors hover:border-brand-magenta/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{project.title}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                      style={{
                        backgroundColor: accent + "22",
                        color: accent,
                      }}
                    >
                      {PROJECT_APPLICATION_STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {a.proposedRole} · {a.hoursPerWeek}h/wk
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">Recent $BUILD activity</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          {recentTx.length === 0 ? (
            <div className="p-6 text-sm text-ink-muted">
              No token activity yet. Complete a project to start earning.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-left">Type</th>
                  <th className="p-4 text-left">Description</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map((tx) => (
                  <tr key={tx.id} className="border-t border-[var(--surface-border)]">
                    <td className="p-4 text-ink-muted">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 capitalize">{tx.type.replace("_", " ")}</td>
                    <td className="p-4 text-ink-muted">{tx.description ?? "—"}</td>
                    <td className="p-4 text-right font-medium">
                      +{Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">
          Drop a beta note
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          What&apos;s working, what&apos;s confusing, what&apos;s broken.
          Lands in admin triage.
        </p>
        <div className="mt-4">
          <FeedbackPrompt
            surface="/dashboard"
            surfaceLabel="Dashboard"
            prompt="How does your dashboard land for you right now?"
          />
        </div>
      </section>
    </div>
  );
}
