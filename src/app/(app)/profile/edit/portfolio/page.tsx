/**
 * /profile/edit/portfolio — Portfolio.
 *
 * One section, one route. Split out of the 1,200-line editor on
 * 2026-09-02 so each menu item is its own page rather than an anchor
 * into a single enormous column.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users as usersTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { getApplicationsForUser } from "@/lib/readers/project-applications";
import {
  getAttributionForUser,
  mvpScoreReader,
  getPortfolioForUser,
  getQuotesForUser,
  getSplitsForRecipient,
  orderReader,
  safely,
  sellerApplicationReader,
} from "@/lib/readers";
import { getAllProjects } from "@/lib/readers/projects";
import { getAllUsers } from "@/lib/readers/users";
import { previewOrderSplit } from "@/lib/order-splits";
import {
  optInDataParticipation,
  optOutDataParticipation,
} from "@/lib/consent-actions";
import { claimDocumensoAccount } from "@/lib/documenso-member-actions";
import { uploadProfileAvatar } from "@/lib/image-upload-actions";
import {
  addMyTalentTag,
  removeMyTalentTag,
  rescanMyTalentTags,
} from "@/lib/talent-tag-actions";
import { getAgreementsForUser } from "@/lib/readers/agreements";
import { championsCourtMembers } from "@/lib/mvp-score";
import {
  AGREEMENT_PROVIDER_LABELS,
  AGREEMENT_TYPE_LABELS,
  INDUSTRY_LABELS,
  type Industry,
} from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Avatar } from "@/components/Avatar";
import { MvpCard } from "@/components/MvpCard";
import {
  loadProfileEditData,
  saveProfile,
  ALL_INDUSTRIES,
  Field,
  Metric,
  SellerStat,
} from "../_shared";
import { EditSectionFrame } from "../_frame";

export const dynamic = "force-dynamic";

export default async function PortfolioEditPage() {
  const d = await loadProfileEditData();
  const {
    user,
    myPortfolio,
    myQuotes,
    myAttribution,
    myPayouts,
    allProjects,
    allOrders,
    sellerApps,
    myMvpSnapshot,
    allScores,
    roster,
    myApplications,
    myAgreements,
    portfolioPublished,
    portfolioPending,
    portfolioRejected,
    quotesApproved,
    quotesPending,
    quotesRejected,
    lifetimePaid,
    myProposalsSent,
    myProposalsAccepted,
    myAssignedProjects,
    myActiveContracts,
    myCompletedContracts,
    sellerApp,
    isApprovedSeller,
    sellerOrders,
    actionableOrders,
    inFlightOrders,
    settledOrders,
    mvp,
    coopProfitsFromMe,
    sellerLifetime,
  } = d;
  void myPortfolio; void myQuotes; void myAttribution; void myPayouts;
  void allProjects; void allOrders; void sellerApps; void myMvpSnapshot;
  void allScores; void roster; void myApplications; void myAgreements;
  void portfolioPublished; void portfolioPending; void portfolioRejected;
  void quotesApproved; void quotesPending; void quotesRejected;
  void lifetimePaid; void myProposalsSent; void myProposalsAccepted;
  void myAssignedProjects; void myActiveContracts; void myCompletedContracts;
  void sellerApp; void isApprovedSeller; void sellerOrders;
  void actionableOrders; void inFlightOrders; void settledOrders; void mvp;
  void Field; void Metric; void SellerStat; void user;
  void saveProfile; void ALL_INDUSTRIES;
  void coopProfitsFromMe; void sellerLifetime;

  return (
    <EditSectionFrame active="portfolio" title="Portfolio" handle={user.handle}>
      <section id="portfolio" className="scroll-mt-24">
      {isApprovedSeller ? (
        <section
          className="mt-6 rounded-2xl border p-6"
          style={{
            borderColor: "rgba(216, 40, 160, 0.45)",
            background:
              "linear-gradient(135deg, rgba(216,40,160,0.08), rgba(80,112,240,0.05))",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardEyebrow>Marketplace fulfillment</CardEyebrow>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                Your seller control room
              </h2>
              <p className="mt-2 max-w-xl text-sm text-ink-muted">
                Triage placed orders, save tracking, advance shipments, and
                watch the split engine settle. Buyers see status changes in
                real time.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Link
                href="/profile/seller/orders"
                className="rounded-full px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm"
                style={{ backgroundColor: "#D828A0" }}
              >
                Open fulfillment dashboard →
              </Link>
              <Link
                href="/profile/seller/products"
                className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-center text-sm hover:border-brand-magenta hover:text-brand-magenta"
              >
                Your listings →
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SellerStat
              label="Action queue"
              value={actionableOrders.length}
              hint="placed · paid · fulfilling"
              accent="#D828A0"
            />
            <SellerStat
              label="In transit"
              value={inFlightOrders.length}
              hint="shipped, awaiting delivery"
              accent="#5070F0"
            />
            <SellerStat
              label="Delivered"
              value={settledOrders.length}
              hint="ready for split"
              accent="#007048"
            />
            <SellerStat
              label="Distributed to you"
              value={`$${Math.round(sellerLifetime).toLocaleString()}`}
              hint="lifetime, after split"
              accent="#5070F0"
            />
          </div>
          {actionableOrders.length > 0 && (
            <p className="mt-4 text-xs text-brand-magenta">
              {actionableOrders.length}{" "}
              {actionableOrders.length === 1 ? "order needs" : "orders need"}{" "}
              your attention.
            </p>
          )}
        </section>
      ) : (
        <Card className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardEyebrow>Marketplace</CardEyebrow>
              <p className="mt-2 text-sm text-ink-muted">
                List goods, services, SaaS or wearables. 85% of every sale
                routes to you; 12% ops, 1.5% Treasury, 1.5% Liquidity Pool.
                Seller applications take 48h in real life.
              </p>
            </div>
            <Link
              href="/profile/seller"
              className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              {sellerApp
                ? sellerApp.status === "pending"
                  ? "View application →"
                  : "Re-apply →"
                : "Apply to sell →"}
            </Link>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Portfolio</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              Submit work samples. Scrub client names and identifying
              details first: pieces that still carry them are sent back for
              revision rather than published.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {portfolioPublished} published
              </span>
              {portfolioPending > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(80,112,240,0.15)",
                    color: "#5070F0",
                  }}
                >
                  {portfolioPending} pending
                </span>
              )}
              {portfolioRejected > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(229,62,62,0.15)",
                    color: "#E53E3E",
                  }}
                >
                  {portfolioRejected} needs revision
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/portfolio"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              Manage portfolio →
            </Link>
            <Link
              href={`/u/${user.handle}`}
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-center text-xs hover:border-brand-magenta"
            >
              View public profile
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Quote sheets</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              Your responses to open RFPs. Admins scrub direct-contact info
              before any sheet reaches the client.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {quotesApproved} sent
              </span>
              {quotesPending > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(80,112,240,0.15)",
                    color: "#5070F0",
                  }}
                >
                  {quotesPending} pending
                </span>
              )}
              {quotesRejected > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(229,62,62,0.15)",
                    color: "#E53E3E",
                  }}
                >
                  {quotesRejected} needs revision
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/quotes"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              Track quotes →
            </Link>
            <Link
              href="/contracts"
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-center text-xs hover:border-brand-magenta"
            >
              Browse open RFPs
            </Link>
          </div>
        </div>
      </Card>
      </section>
    </EditSectionFrame>
  );
}
