/**
 * /profile/edit/identity — Identity.
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
import { IdentityForm } from "@/components/IdentityForm";

export const dynamic = "force-dynamic";

export default async function IdentityEditPage() {
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

  // Artists get the press kit tab and the alias field.
  const isArtist = user.profileMode === "epk";

  return (
    <EditSectionFrame
      active="identity"
      title="Identity"
      handle={user.handle}
      isArtist={isArtist}
    >
      <section id="identity" className="scroll-mt-24">
      {/* Avatar upload — separate form so file uploads don't get
          entangled with the main text-field save action. Task #58. */}
      <Card className="mt-6">
        <CardEyebrow>Profile image</CardEyebrow>
        <form
          action={uploadProfileAvatar}
          className="mt-4 flex flex-wrap items-center gap-4"
          encType="multipart/form-data"
        >
          <Avatar user={user} size="xl" />
          <div className="flex-1 min-w-0">
            <input
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/tiff"
              required
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--fm-grad-from)] file:text-black file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
            />
            <p className="mt-1.5 text-[11px] text-ink-faint">
              JPEG / PNG / WebP up to 25 MB. Resized to three variants
              (thumbnail, medium, full) and served from R2 through the
              FM domain.
            </p>
          </div>
          <button
            type="submit"
            className="fm-btn-primary rounded-full px-5 py-2 text-sm font-medium"
          >
            Upload
          </button>
        </form>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Edit</CardEyebrow>
        <IdentityForm
          user={{
            id: user.id,
            handle: user.handle,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName ?? null,
            tagline: user.tagline ?? null,
            bio: user.bio ?? null,
            portfolioUrl: user.portfolioUrl ?? null,
            profileImageUrl: user.profileImageUrl ?? null,
            primaryIndustry: user.primaryIndustry ?? null,
            secondaryIndustries: user.secondaryIndustries,
            skills: user.skills,
            isArtist,
          }}
        />
      </Card>
      </section>
    </EditSectionFrame>
  );
}
