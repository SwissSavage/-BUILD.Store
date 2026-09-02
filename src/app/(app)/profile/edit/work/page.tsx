/**
 * /profile/edit/work — Work.
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

export default async function WorkEditPage() {
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
    <EditSectionFrame active="work" title="Work" handle={user.handle}>
      <section id="work" className="scroll-mt-24">
      {/* Personal cockpit — metrics + contracts. Uncluttered snapshot
          of what you've done, what's live, and what's earned. Every
          profile gets this; client-side view (project sign-off) lands
          when magic-link → optional account creation ships (task #44
          extension). */}
      <Card className="mt-6">
        <CardEyebrow>Your work at a glance</CardEyebrow>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Metric label="Proposals sent" value={myProposalsSent} />
          <Metric label="Accepted" value={myProposalsAccepted} />
          <Metric label="Completed" value={myCompletedContracts.length} />
          <Metric label="Currently active" value={myActiveContracts.length} />
          <Metric
            label="Revenue earned"
            value={`$${lifetimePaid.toLocaleString()}`}
          />
          <Metric
            label="FM cooperative share"
            value={`$${coopProfitsFromMe.toLocaleString()}`}
            hint="Approximate 15/85 share of your paid engagements."
          />
        </div>
      </Card>

      {/* My contracts — quick uncluttered review of what's in flight
          and what's wrapped. Clicking through goes to the project
          tracker (task #46). Client sign-off surface lives on the
          same shape once client-side accounts land. */}
      {(myActiveContracts.length > 0 || myCompletedContracts.length > 0) && (
        <Card className="mt-6">
          <CardEyebrow>Your contracts</CardEyebrow>
          {myActiveContracts.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-brand-magenta">
                Currently active
              </p>
              <ul className="mt-2 space-y-2">
                {myActiveContracts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-baseline justify-between rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-3 py-2"
                  >
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-sm font-medium hover:text-brand-magenta"
                    >
                      {p.title}
                    </Link>
                    <span className="text-[11px] text-ink-faint">
                      {INDUSTRY_LABELS[p.industry]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {myCompletedContracts.length > 0 && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wider text-ink-muted">
                Completed
              </p>
              <ul className="mt-2 space-y-2">
                {myCompletedContracts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-baseline justify-between rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-sm hover:text-brand-magenta"
                    >
                      {p.title}
                    </Link>
                    <span className="text-[11px] text-ink-faint">
                      {INDUSTRY_LABELS[p.industry]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {(() => {
        const mvpSnapshot = myMvpSnapshot;
        if (!mvpSnapshot) return null;
        const courtIds = new Set(championsCourtMembers(allScores, roster));
        const isInCourt = courtIds.has(user.id);
        return (
          <div className="mt-6">
            <MvpCard
              snapshot={mvpSnapshot}
              user={user}
              mode="self"
              isInCourt={isInCourt}
            />
            <p className="mt-2 text-[11px] text-ink-faint">
              Your MVP Score. Sub-rating breakdown is self-only by
              cooperative policy. Peer Members see your OVR + standing
              band + active compliance signal (if any), nothing else.
              Public web sees nothing. See <code>future-modern.md</code>{" "}
              &quot;MVP Score&quot; for the full architecture.
            </p>
          </div>
        );
      })()}

      </section>
    </EditSectionFrame>
  );
}
