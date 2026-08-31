/**
 * Admin landing — quick links + at-a-glance counts.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { championsCourtMembers } from "@/lib/mvp-score";
import { getAllUsers } from "@/lib/readers/users";
import { getAllProjects } from "@/lib/readers/projects";
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
  tokenReader,
  whitelistPurchaseReader,
} from "@/lib/readers";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

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
  ]);

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
      title: "Inbound",
      count: inboundOpen,
      sub: `Open across signups, RFPs, chats, quotes, partner apps · ${inboundRows.length} total`,
    },
    {
      href: "/admin/mvp",
      title: "MVP Score",
      count: championsCircleCount,
      sub: `Champion's Court (top 10% AND ≥ 90) · ${scores.length} snapshots`,
    },
    { href: "/admin/members", title: "Members", count: roster.length, sub: "Across all tiers" },
    { href: "/admin/applications", title: "Applications", count: pending, sub: "Pending review" },
    { href: "/admin/projects", title: "Projects", count: openProjects, sub: "Open RFPs" },
    {
      href: "/admin/rfps",
      title: "RFP intake",
      count: rfpPending,
      sub: "Client submissions awaiting vetting",
    },
    {
      href: "/admin/quotes",
      title: "Quote sheets",
      count: quotesPending,
      sub: "Awaiting approval to client",
    },
    {
      href: "/admin/portfolios",
      title: "Portfolio review",
      count: portfolioPending,
      sub: "Pending PII scrub",
    },
    {
      href: "/admin/contracts",
      title: "Contract operations",
      count: Math.round(outstandingAR),
      sub: "$ outstanding AR · attribution + settle + AR/AP ledger",
    },
    {
      href: "/admin/tokens",
      title: "$BUILD distributed",
      count: Math.round(totalDistributed),
      sub: "All-time, all members",
    },
    {
      href: "/admin/marketplace",
      title: "Marketplace",
      count: marketplaceQueue,
      sub: `${sellerAppsPending} seller apps · ${productsPending} listings pending`,
    },
    {
      href: "/admin/whitelist",
      title: "Whitelist",
      count: whitelistQueue,
      sub: `${whitelistOpen} donations open · ${consultNew} consults new · access not for sale`,
    },
    {
      href: "/admin/team",
      title: "Team",
      count: roster.filter((u) => u.isAdmin).length,
      sub: "Active admins",
    },
    {
      href: "/admin/feedback",
      title: "Beta feedback",
      count: feedbackNew,
      sub: `${feedbackRows.length} total · ${feedbackNew} untriaged`,
    },
    {
      href: "/admin/testimonials",
      title: "Testimonials",
      count: testimonialsPending,
      sub: `${testimonialsPending} customer reviews awaiting promotion`,
    },
    {
      href: "/admin/payments",
      title: "Payments",
      count: splits.filter(
        (s) => s.payoutStatus === "queued" || s.payoutStatus === "pending",
      ).length,
      sub: "Payout rail status · manual-send queue",
    },
    {
      href: "/admin/compliance",
      title: "Compliance",
      count: auditRows.length,
      sub: "SOC 2 + ISO 27001 control status · audit log entries",
    },
    {
      href: "/admin/audit-log",
      title: "Audit log",
      count: auditRows.length,
      sub: "Append-only. Every security-relevant action, reverse-chron.",
    },
    {
      href: "/admin/access-review",
      title: "Access review",
      count: roster.filter((u) => u.isAdmin).length,
      sub: "Admins carrying the flag · quarterly walk-through cadence",
    },
    {
      href: "/admin/walkthrough",
      title: "Walkthrough / stress test",
      count: 12,
      sub: "Tier-by-tier audit + 12 stress tests · Bayu copy audit",
    },
  ];

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Admin</h1>
      <p className="mt-2 text-ink-muted">Cooperative operations console.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="transition-colors hover:border-brand-magenta">
              <CardEyebrow>{t.title}</CardEyebrow>
              <CardTitle className="mt-2 text-3xl">
                {t.count.toLocaleString()}
              </CardTitle>
              <p className="mt-1 text-xs text-ink-muted">{t.sub}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
