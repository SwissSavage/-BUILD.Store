/**
 * Admin landing — quick links + at-a-glance counts.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_APPLICATIONS } from "@/lib/mock-data/applications";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data/tokens";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { MOCK_QUOTES } from "@/lib/mock-data/quotes";
import { MOCK_INVOICES } from "@/lib/mock-data/invoices";
import { MOCK_SELLER_APPLICATIONS } from "@/lib/mock-data/seller-applications";
import { MOCK_PRODUCTS } from "@/lib/mock-data/products";
import {
  MOCK_WHITELIST_PURCHASES,
  MOCK_CONSULTATION_REQUESTS,
} from "@/lib/mock-data/whitelist";
import { MOCK_FEEDBACK } from "@/lib/mock-data/feedback";
import { MOCK_CUSTOMER_FEEDBACK } from "@/lib/mock-data/customer-feedback";
import { listInboundSubmissions } from "@/lib/mock-data/inbound-submissions";
import { MOCK_MVP_SCORES } from "@/lib/mock-data/mvp-scores";
import { MOCK_AUDIT_LOG } from "@/lib/mock-data/audit-log";
import { championsCourtMembers } from "@/lib/mvp-score";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function AdminHome() {
  await requireAdmin();

  const pending = MOCK_APPLICATIONS.filter((a) => a.status === "pending").length;
  const openProjects = MOCK_PROJECTS.filter((p) => p.status === "open").length;
  const rfpPending = MOCK_PROJECTS.filter(
    (p) =>
      p.kind === "contract" &&
      p.isRfp &&
      !p.rfpApprovedAt &&
      p.status !== "cancelled",
  ).length;
  const portfolioPending = MOCK_PORTFOLIO.filter(
    (p) => !p.publishedAt && !p.rejectedAt,
  ).length;
  const quotesPending = MOCK_QUOTES.filter(
    (q) => !q.approvedAt && !q.rejectedAt,
  ).length;
  const totalDistributed = MOCK_TRANSACTIONS.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0,
  );
  const outstandingAR = MOCK_INVOICES.reduce((sum, inv) => {
    if (inv.status === "draft" || inv.status === "void") return sum;
    return sum + (Number(inv.total) - Number(inv.paidAmount));
  }, 0);
  const sellerAppsPending = MOCK_SELLER_APPLICATIONS.filter(
    (a) => a.status === "pending",
  ).length;
  const productsPending = MOCK_PRODUCTS.filter(
    (p) => p.status === "pending_review",
  ).length;
  const marketplaceQueue = sellerAppsPending + productsPending;
  const whitelistOpen = MOCK_WHITELIST_PURCHASES.filter(
    (p) => p.status === "initiated" || p.status === "paid",
  ).length;
  const consultNew = MOCK_CONSULTATION_REQUESTS.filter(
    (r) => r.status === "new",
  ).length;
  const whitelistQueue = whitelistOpen + consultNew;
  const feedbackNew = MOCK_FEEDBACK.filter((f) => f.status === "new").length;
  const testimonialsPending = MOCK_CUSTOMER_FEEDBACK.filter(
    (f) => f.publishedAt === null,
  ).length;
  const inboundRows = listInboundSubmissions();
  const inboundOpen = inboundRows.filter(
    (r) => r.status === "new" || r.status === "in_triage" || r.status === "needs_info",
  ).length;
  const championsCircleCount = championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS).length;

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
      sub: `Champion's Court (top 10% AND ≥ 90) · ${MOCK_MVP_SCORES.length} snapshots`,
    },
    { href: "/admin/members", title: "Members", count: MOCK_USERS.length, sub: "Across all tiers" },
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
      count: MOCK_USERS.filter((u) => u.isAdmin).length,
      sub: "Active admins",
    },
    {
      href: "/admin/feedback",
      title: "Beta feedback",
      count: feedbackNew,
      sub: `${MOCK_FEEDBACK.length} total · ${feedbackNew} untriaged`,
    },
    {
      href: "/admin/testimonials",
      title: "Testimonials",
      count: testimonialsPending,
      sub: `${testimonialsPending} customer reviews awaiting promotion`,
    },
    {
      href: "/admin/compliance",
      title: "Compliance",
      count: MOCK_AUDIT_LOG.length,
      sub: "SOC 2 + ISO 27001 control status · audit log entries",
    },
    {
      href: "/admin/audit-log",
      title: "Audit log",
      count: MOCK_AUDIT_LOG.length,
      sub: "Append-only. Every security-relevant action, reverse-chron.",
    },
    {
      href: "/admin/access-review",
      title: "Access review",
      count: MOCK_USERS.filter((u) => u.isAdmin).length,
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
