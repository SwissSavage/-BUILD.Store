/**
 * /profile/edit/money — Money.
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

export default async function MoneyEditPage() {
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
    <EditSectionFrame active="money" title="Money" handle={user.handle}>
      <section id="money" className="scroll-mt-24">
      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Payouts (Stripe Connect)</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              We never store your bank info — Stripe holds it. We only retain
              your tokenized account reference, so a breach on our side
              can&apos;t expose anything that touches money.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {user.stripePayoutsEnabled ? (
                <span
                  className="rounded-full px-2.5 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(0,112,72,0.15)",
                    color: "var(--fm-green-text)",
                  }}
                >
                  Payouts enabled
                </span>
              ) : user.stripeAccountId ? (
                <span
                  className="rounded-full px-2.5 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(80,112,240,0.15)",
                    color: "var(--fm-blue-text)",
                  }}
                >
                  Onboarding incomplete
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(229,62,62,0.15)",
                    color: "var(--fm-red-text)",
                  }}
                >
                  Not connected
                </span>
              )}
              {user.stripeAccountId && (
                <span className="font-mono text-ink-faint">
                  {user.stripeAccountId.slice(0, 16)}…
                </span>
              )}
            </div>
            {lifetimePaid > 0 && (
              <p className="mt-3 text-xs text-ink-faint">
                Lifetime paid through the cooperative:{" "}
                <span className="font-medium text-ink">
                  ${lifetimePaid.toLocaleString()}
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/payouts"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-black"
            >
              {user.stripeAccountId ? "Manage payouts →" : "Connect payouts →"}
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Attribution</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              The ledger of contracts where you&apos;ve been credited.
              Drives your share of the 85% contributor pool when revenue
              settles. Append-only — historical record stays intact.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {myAttribution.length} ledger{" "}
                {myAttribution.length === 1 ? "entry" : "entries"}
              </span>
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {myPayouts.length} payout{" "}
                {myPayouts.length === 1 ? "row" : "rows"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/attribution"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-black"
            >
              View ledger →
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Wallet</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">ERC-6551 token-bound account</p>
        <p className="mt-2 font-mono text-sm">
          {user.walletAddress ?? "Not yet provisioned"}
        </p>
      </Card>
      </section>
    </EditSectionFrame>
  );
}
