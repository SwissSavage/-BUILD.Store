/**
 * Admin landing — quick links + at-a-glance counts.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { championsCourtMembers } from "@/lib/mvp-score";
import { getAllUsers } from "@/lib/readers/users";
import { getAllProjects, getDeletedProjects } from "@/lib/readers/projects";
import {
  auditLogReader,
  consultationRequestReader,
  customerFeedbackReader,
  feedbackReader,
  inboundReader,
  invoiceReader,
  membershipApplicationReader,
  mvpScoreReader,
  portfolioReader,
  productReader,
  quoteSheetReader,
  safely,
  sellerApplicationReader,
  splitReader,
  servicePartnerReader,
  ecosystemPartnerReader,
  productAffiliateReader,
  jobReader,
  tokenReader,
  whitelistPurchaseReader,
} from "@/lib/readers";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

/**
 * Tile groups, ordered by how often an admin arrives wanting them.
 * "Create" sits first because posting work is the thing you come here
 * to do; everything else is reacting to what already exists.
 */
const GROUPS = [
  {
    key: "create",
    label: "Create",
    blurb: "Put something new into the cooperative.",
  },
  {
    key: "queues",
    label: "Needs a decision",
    blurb: "Things waiting on you. The counts are what is open, not the total.",
  },
  {
    key: "money",
    label: "Money",
    blurb: "Attribution, settlement, payouts, $BUILD.",
  },
  {
    key: "people",
    label: "People + work",
    blurb: "Roster, standing, and everything in flight.",
  },
  {
    key: "governance",
    label: "Governance",
    blurb: "Audit trail, access, compliance, trash.",
  },
] as const;

export default async function AdminHome() {
  await requireAdmin();

  // Reader swap 2026-08-29: every tile count came from a mock array,
  // so the admin console reported the seed cooperative's numbers, not
  // the real one. Loaded in parallel — sixteen sequential queries on
  // the landing page would be noticeable.
  const [
    { users: roster },
    { projects: allProjects },
    applications,
    portfolio,
    quotes,
    transactions,
    invoiceRows,
    sellerApps,
    productRows,
    whitelistRows,
    consultRows,
    feedbackRows,
    customerFeedbackRows,
    inboundRows,
    auditRows,
    scores,
    splits,
    servicePartnerRows,
    ecosystemPartnerRows,
    affiliateRows,
    jobRows,
    trashedProjects,
  ] = await Promise.all([
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    safely(() => getAllProjects(), {
      projects: [],
      source: "postgres" as const,
    }),
    safely(() => membershipApplicationReader.all(), []),
    safely(() => portfolioReader.all(), []),
    safely(() => quoteSheetReader.all(), []),
    safely(() => tokenReader.all(), []),
    safely(() => invoiceReader.all(), []),
    safely(() => sellerApplicationReader.all(), []),
    safely(() => productReader.all(), []),
    safely(() => whitelistPurchaseReader.all(), []),
    safely(() => consultationRequestReader.all(), []),
    safely(() => feedbackReader.all(), []),
    safely(() => customerFeedbackReader.all(), []),
    safely(() => inboundReader.all(), []),
    safely(() => auditLogReader.all(), []),
    safely(() => mvpScoreReader.all(), []),
    safely(() => splitReader.all(), []),
    safely(() => servicePartnerReader.all(), []),
    safely(() => ecosystemPartnerReader.all(), []),
    safely(() => productAffiliateReader.all(), []),
    safely(() => jobReader.all(), []),
    safely(() => getDeletedProjects(), []),
  ]);

  const trashedCount = trashedProjects.length;

  const openJobCount = jobRows.filter((j) => j.status === "open").length;

  const partnerCount =
    servicePartnerRows.length +
    ecosystemPartnerRows.length +
    affiliateRows.length;

  const pending = applications.filter((a) => a.status === "pending").length;
  const openProjects = allProjects.filter((p) => p.status === "open").length;
  const rfpPending = allProjects.filter(
    (p) =>
      p.kind === "contract" &&
      p.isRfp &&
      !p.rfpApprovedAt &&
      p.status !== "cancelled",
  ).length;
  const portfolioPending = portfolio.filter(
    (p) => !p.publishedAt && !p.rejectedAt,
  ).length;
  const quotesPending = quotes.filter(
    (q) => !q.approvedAt && !q.rejectedAt,
  ).length;
  const totalDistributed = transactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0,
  );
  const outstandingAR = invoiceRows.reduce((sum, inv) => {
    if (inv.status === "draft" || inv.status === "void") return sum;
    return sum + (Number(inv.total) - Number(inv.paidAmount));
  }, 0);
  const sellerAppsPending = sellerApps.filter(
    (a) => a.status === "pending",
  ).length;
  const productsPending = productRows.filter(
    (p) => p.status === "pending_review",
  ).length;
  const marketplaceQueue = sellerAppsPending + productsPending;
  const whitelistOpen = whitelistRows.filter(
    (p) => p.status === "initiated" || p.status === "paid",
  ).length;
  const consultNew = consultRows.filter(
    (r) => r.status === "new",
  ).length;
  const whitelistQueue = whitelistOpen + consultNew;
  const feedbackNew = feedbackRows.filter((f) => f.status === "new").length;
  const testimonialsPending = customerFeedbackRows.filter(
    (f) => f.publishedAt === null,
  ).length;
  const inboundOpen = inboundRows.filter(
    (r) => r.status === "new" || r.status === "in_triage" || r.status === "needs_info",
  ).length;
  const championsCircleCount = championsCourtMembers(scores, roster).length;

  const tiles = [
    {
      href: "/admin/inbound",
      group: "queues",
      title: "Inbound",
      count: inboundOpen,
      sub: `Open across signups, RFPs, chats, quotes, partner apps · ${inboundRows.length} total`,
    },
    {
      href: "/admin/mvp",
      group: "people",
      title: "MVP Score",
      count: championsCircleCount,
      sub: `Champion's Court (top 10% AND ≥ 90) · ${scores.length} snapshots`,
    },
    { href: "/admin/members",
      group: "people", title: "Members", count: roster.length, sub: "Across all tiers" },
    { href: "/admin/applications",
      group: "queues", title: "Applications", count: pending, sub: "Pending review" },
    { href: "/admin/projects",
      group: "people", title: "Projects", count: openProjects, sub: "Open RFPs" },
    {
      href: "/admin/contracts/new",
      group: "create",
      title: "Post a contract",
      count: openProjects,
      sub: "Goes live immediately · open contracts shown",
    },
    {
      href: "/admin/rfps",
      group: "queues",
      title: "RFP intake",
      count: rfpPending,
      sub: "Client submissions awaiting vetting",
    },
    {
      href: "/admin/quotes",
      group: "queues",
      title: "Quote sheets",
      count: quotesPending,
      sub: "Awaiting approval to client",
    },
    {
      href: "/admin/portfolios",
      group: "queues",
      title: "Portfolio review",
      count: portfolioPending,
      sub: "Pending PII scrub",
    },
    {
      href: "/admin/contracts",
      group: "money",
      title: "Contract operations",
      count: Math.round(outstandingAR),
      sub: "$ outstanding AR · attribution + settle + AR/AP ledger",
    },
    {
      href: "/admin/tokens",
      group: "money",
      title: "$BUILD distributed",
      count: Math.round(totalDistributed),
      sub: "All-time, all members",
    },
    {
      href: "/admin/marketplace",
      group: "queues",
      title: "Marketplace",
      count: marketplaceQueue,
      sub: `${sellerAppsPending} seller apps · ${productsPending} listings pending`,
    },
    {
      href: "/admin/whitelist",
      group: "queues",
      title: "Whitelist",
      count: whitelistQueue,
      sub: `${whitelistOpen} donations open · ${consultNew} consults new · access not for sale`,
    },
    {
      href: "/admin/members/invite",
      group: "create",
      title: "Invite someone",
      count: roster.length,
      sub: "Onto a contract or general membership · members shown",
    },
    {
      href: "/admin/jobs",
      group: "create",
      title: "Jobs",
      count: openJobCount,
      sub: `${openJobCount} open on the public board · ${jobRows.length} total`,
    },
    {
      href: "/admin/partners",
      group: "create",
      title: "Partners",
      count: partnerCount,
      sub: "Service + SaaS partners and affiliates · all public-facing",
    },
    {
      href: "/admin/team",
      group: "people",
      title: "Team",
      count: roster.filter((u) => u.isAdmin).length,
      sub: "Active admins",
    },
    {
      href: "/admin/feedback",
      group: "queues",
      title: "Beta feedback",
      count: feedbackNew,
      sub: `${feedbackRows.length} total · ${feedbackNew} untriaged`,
    },
    {
      href: "/admin/testimonials",
      group: "queues",
      title: "Testimonials",
      count: testimonialsPending,
      sub: `${testimonialsPending} customer reviews awaiting promotion`,
    },
    {
      href: "/admin/payments",
      group: "money",
      title: "Payments",
      count: splits.filter(
        (s) => s.payoutStatus === "queued" || s.payoutStatus === "pending",
      ).length,
      sub: "Payout rail status · manual-send queue",
    },
    {
      href: "/admin/compliance",
      group: "governance",
      title: "Compliance",
      count: auditRows.length,
      sub: "SOC 2 + ISO 27001 control status · audit log entries",
    },
    {
      href: "/admin/audit-log",
      group: "governance",
      title: "Audit log",
      count: auditRows.length,
      sub: "Append-only. Every security-relevant action, reverse-chron.",
    },
    {
      href: "/admin/access-review",
      group: "governance",
      title: "Access review",
      count: roster.filter((u) => u.isAdmin).length,
      sub: "Admins carrying the flag · quarterly walk-through cadence",
    },
    {
      href: "/admin/trash",
      group: "governance",
      title: "Trash",
      count: trashedCount,
      sub: "Deleted projects · restorable for 30 days",
    },
    {
      href: "/admin/walkthrough",
      group: "governance",
      title: "Walkthrough / stress test",
      count: 12,
      sub: "Tier-by-tier audit + 12 stress tests · Bayu copy audit",
    },
  ];

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Admin</h1>
      <p className="mt-2 text-ink-muted">Cooperative operations console.</p>

      {/* Grouped by what you came here to do. A flat grid of two
          dozen tiles meant the thing you needed was findable only if
          you already knew its name — "post a contract" in particular
          read as just another number. */}
      {GROUPS.map((group) => {
        const groupTiles = tiles.filter((t) => t.group === group.key);
        if (groupTiles.length === 0) return null;
        return (
          <section key={group.key} className="mt-10">
            <h2 className="font-display text-2xl font-semibold">
              {group.label}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{group.blurb}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {groupTiles.map((t) => (
                <Link key={t.href} href={t.href}>
                  <Card className="h-full transition-colors hover:border-brand-magenta">
                    <CardEyebrow>{t.title}</CardEyebrow>
                    <CardTitle className="mt-2 text-3xl">
                      {t.count.toLocaleString()}
                    </CardTitle>
                    <p className="mt-1 text-xs text-ink-muted">{t.sub}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
