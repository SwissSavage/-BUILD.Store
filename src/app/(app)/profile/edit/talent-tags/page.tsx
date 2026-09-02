/**
 * /profile/edit/talent-tags — Talent tags.
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

export default async function TalentTagsEditPage() {
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
    <EditSectionFrame active="talent-tags" title="Talent tags" handle={user.handle}>
      <section id="tags" className="scroll-mt-24">
      <Card className="mt-6 border-[#D828A0]/40">
        <CardEyebrow>Talent match tags</CardEyebrow>
        <h2 className="mt-1 font-display text-xl font-semibold">
          How the cooperative routes opportunities to you
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          The cooperative scrubs your bio, skills, discipline, and
          portfolio for keywords, then matches them against incoming
          briefs even when clients use different vocabulary. You can
          add tags we missed and remove anything that doesn&apos;t
          represent you. Tier-1 operational use (internal matching) is
          governed by registration terms.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(user.talentTags ?? []).length === 0 ? (
            <span className="text-xs text-ink-muted">
              No tags yet. Rescan to populate.
            </span>
          ) : (
            (user.talentTags ?? []).map((t) => (
              <form key={t} action={removeMyTalentTag}>
                <input type="hidden" name="tag" value={t} />
                <button
                  type="submit"
                  className="group rounded-full px-3 py-1 text-xs"
                  style={{
                    backgroundColor: "rgba(216, 40, 160, 0.10)",
                    color: "#D828A0",
                  }}
                  title="Click to remove"
                >
                  #{t}{" "}
                  <span className="opacity-0 transition-opacity group-hover:opacity-100">
                    ✕
                  </span>
                </button>
              </form>
            ))
          )}
        </div>

        <form action={addMyTalentTag} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-muted">
            Add tag(s) — comma or space separated
            <input
              name="tag"
              placeholder="retrofit, brand-system, gtm"
              className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm normal-case tracking-normal text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            Append
          </button>
        </form>

        <form action={rescanMyTalentTags} className="mt-3">
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Rescan from bio + skills + portfolio
          </button>
        </form>
      </Card>
      </section>
    </EditSectionFrame>
  );
}
