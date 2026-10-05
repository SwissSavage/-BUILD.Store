/**
 * Admin landing — quick links + at-a-glance counts.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { adminNavGroups, type AdminNavGroup } from "@/lib/admin-nav";
import { championsCourtMembers } from "@/lib/mvp-score";
import { getAllUsers } from "@/lib/readers/users";
import { getAllProjects, getDeletedProjects } from "@/lib/readers/projects";
import {
  auditLogReader,
  consultationRequestReader,
  customerFeedbackReader,
  ecosystemPartnerReader,
  feedbackReader,
  getAllPeerReviews,
  inboundReader,
  invoiceReader,
  jobReader,
  membershipApplicationReader,
  mvpScoreReader,
  portfolioReader,
  productAffiliateReader,
  productReader,
  quoteSheetReader,
  safely,
  sellerApplicationReader,
  servicePartnerReader,
  splitReader,
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
/**
 * Section descriptions. The section names and their membership live in
 * ADMIN_NAV; only the prose is page-local, because the nav dropdown has
 * no room for it.
 */
const GROUP_BLURBS: Record<AdminNavGroup, string> = {
  queues: "Things waiting on you. The counts are what is open, not the total.",
  people: "Roster, standing, and recognition.",
  deals: "Projects, contracts, quotes, and the people who bring them in.",
  money: "Attribution, settlement, payouts, $BUILD.",
  content: "Everything members and visitors read or post.",
  governance: "Audit trail, access, compliance, trash.",
  create: "Put something new into the cooperative.",
};

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
    peerReviewRows,
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
    safely(() => getAllPeerReviews(), []),
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
  const peerReviewsVoided = peerReviewRows.filter((r) => r.voidedAt).length;
  const testimonialsPending = customerFeedbackRows.filter(
    (f) => f.publishedAt === null,
  ).length;
  const inboundOpen = inboundRows.filter(
    (r) => r.status === "new" || r.status === "in_triage" || r.status === "needs_info",
  ).length;
  const championsCircleCount = championsCourtMembers(scores, roster).length;

  // Live counts for the destinations that have one. Labels and
  // grouping come from ADMIN_NAV so the dropdown, the mobile menu
  // and this page cannot disagree about what exists or what it is
  // called. A destination with no entry here still renders, just
  // without a number.
  const tileMeta: Record<string, { count: number; sub: string }> = {
    "/admin/inbound": {
      count: inboundOpen,
      sub: `Open across signups, RFPs, chats, quotes, partner apps · ${inboundRows.length} total`,
    },
    "/admin/mvp": {
      count: championsCircleCount,
      sub: `Champion's Court (top 10% AND ≥ 90) · ${scores.length} snapshots`,
    },
    "/admin/members": {
      count: roster.length,
      sub: "Across all tiers",
    },
    "/admin/applications": {
      count: pending,
      sub: "Pending review",
    },
    "/admin/projects": {
      count: openProjects,
      sub: "Open RFPs",
    },
    "/admin/contracts/new": {
      count: openProjects,
      sub: "Goes live immediately · open contracts shown",
    },
    "/admin/rfps": {
      count: rfpPending,
      sub: "Client submissions awaiting vetting",
    },
    "/admin/quotes": {
      count: quotesPending,
      sub: "Awaiting approval to client",
    },
    "/admin/portfolios": {
      count: portfolioPending,
      sub: "Pending PII scrub",
    },
    "/admin/contracts": {
      count: Math.round(outstandingAR),
      sub: "$ outstanding AR · attribution + settle + AR/AP ledger",
    },
    "/admin/tokens": {
      count: Math.round(totalDistributed),
      sub: "All-time, all members",
    },
    "/admin/marketplace": {
      count: marketplaceQueue,
      sub: `${sellerAppsPending} seller apps · ${productsPending} listings pending`,
    },
    "/admin/whitelist": {
      count: whitelistQueue,
      sub: `${whitelistOpen} donations open · ${consultNew} consults new · access not for sale`,
    },
    "/admin/members/invite": {
      count: roster.length,
      sub: "Onto a contract or general membership · members shown",
    },
    "/admin/jobs": {
      count: openJobCount,
      sub: `${openJobCount} open on the public board · ${jobRows.length} total`,
    },
    "/admin/partners": {
      count: partnerCount,
      sub: "Service + SaaS partners and affiliates · all public-facing",
    },
    "/admin/team": {
      count: roster.filter((u) => u.isAdmin).length,
      sub: "Active admins",
    },
    "/admin/feedback": {
      count: feedbackNew,
      sub: `${feedbackRows.length} total · ${feedbackNew} untriaged`,
    },
    "/admin/peer-reviews": {
      count: peerReviewRows.length - peerReviewsVoided,
      sub: `${peerReviewRows.length} written · ${peerReviewsVoided} voided`,
    },
    "/admin/testimonials": {
      count: testimonialsPending,
      sub: `${testimonialsPending} customer reviews awaiting promotion`,
    },
    "/admin/payments": {
      count: splits.filter(
        (s) => s.payoutStatus === "queued" || s.payoutStatus === "pending",
      ).length,
      sub: "Payout rail status · manual-send queue",
    },
    "/admin/compliance": {
      count: auditRows.length,
      sub: "SOC 2 + ISO 27001 control status · audit log entries",
    },
    "/admin/audit-log": {
      count: auditRows.length,
      sub: "Append-only. Every security-relevant action, reverse-chron.",
    },
    "/admin/access-review": {
      count: roster.filter((u) => u.isAdmin).length,
      sub: "Admins carrying the flag · quarterly walk-through cadence",
    },
    "/admin/trash": {
      count: trashedCount,
      sub: "Deleted projects · restorable for 30 days",
    },
    "/admin/walkthrough": {
      count: 12,
      sub: "Tier-by-tier audit + 12 stress tests · Bayu copy audit",
    },
  };


  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Admin</h1>
      <p className="mt-2 text-ink-muted">Cooperative operations console.</p>

      {/* Grouped by what you came here to do. A flat grid of two
          dozen tiles meant the thing you needed was findable only if
          you already knew its name — "post a contract" in particular
          read as just another number.

          Sections and their contents come from ADMIN_NAV, the same
          list the nav dropdown and the mobile menu read. Before that
          existed, this page showed 26 of the 61 admin pages and the
          dropdown showed a different 24, so a destination could be
          missing from both and nobody would notice. */}
      {adminNavGroups().map((section) => (
        <section key={section.group} className="mt-10">
          <h2 className="font-display text-2xl font-semibold">
            {section.label}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {GROUP_BLURBS[section.group]}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {section.entries.map((entry) => {
              const meta = tileMeta[entry.href];
              return (
                <Link key={entry.href} href={entry.href}>
                  <Card className="h-full transition-colors hover:border-brand-magenta">
                    <CardEyebrow>{entry.label}</CardEyebrow>
                    {meta ? (
                      <>
                        <CardTitle className="mt-2 text-3xl">
                          {meta.count.toLocaleString()}
                        </CardTitle>
                        <p className="mt-1 text-xs text-ink-muted">
                          {meta.sub}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-ink-muted">Open →</p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
