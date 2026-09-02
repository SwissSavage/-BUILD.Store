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

  return (
    <EditSectionFrame active="identity" title="Identity" handle={user.handle}>
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
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-magenta file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
            />
            <p className="mt-1.5 text-[11px] text-ink-faint">
              JPEG / PNG / WebP up to 25 MB. Resized to three variants
              (thumbnail, medium, full) and served from R2 through the
              FM domain.
            </p>
          </div>
          <button
            type="submit"
            className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Upload
          </button>
        </form>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Edit</CardEyebrow>
        <form action={saveProfile} className="mt-4 space-y-5">
          <input type="hidden" name="uid" value={user.id} />

          {/* Avatar preview + upload lives in its own Card above.
              Keep the current URL as a hidden field so saveProfile
              doesn't clobber it back to empty on the next save.
              uploadProfileAvatar writes the fresh URL directly to
              the DB on upload success. */}
          <input
            type="hidden"
            name="profileImageUrl"
            value={user.profileImageUrl ?? ""}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Field name="firstName" label="First name" defaultValue={user.firstName ?? ""} />
            <Field name="lastName" label="Last name" defaultValue={user.lastName ?? ""} />
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-brand-magenta">
              Display name
            </span>
            <input
              name="displayName"
              defaultValue={user.displayName ?? ""}
              placeholder="e.g. Sahtyre"
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
            />
            <span className="mt-1 block text-[11px] text-ink-faint">
              How your name appears publicly. Leave it empty to use{" "}
              &ldquo;{[user.firstName, user.lastName?.[0] ? `${user.lastName[0]}.` : null].filter(Boolean).join(" ") || "your first name"}&rdquo;.
              Set it if you go by one name, a stage name, or the invite
              spelled yours wrong.
            </span>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Tagline
            </span>
            <input
              name="tagline"
              defaultValue={user.tagline ?? ""}
              maxLength={120}
              placeholder="e.g. RevOps strategist for B2B services orgs"
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              One line, in the words you&apos;d use with a client. Shows
              on your card, the roster, client-facing bid cards, and
              anywhere you&apos;re listed. Up to 120 characters.
            </p>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Primary pillar
            </span>
            <select
              name="primaryIndustry"
              defaultValue={user.primaryIndustry ?? "creative-media"}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            >
              {ALL_INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {INDUSTRY_LABELS[i]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-faint">
              Where you spend most of your time. Drives default RFP and job matching.
            </p>
          </label>

          <fieldset className="rounded-lg border border-[var(--surface-border)] p-4">
            <legend className="px-2 text-xs uppercase tracking-wider text-ink-muted">
              Secondary pillars
            </legend>
            <p className="text-xs text-ink-faint">
              Additional areas you contribute to. Expands matching beyond your primary.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              {ALL_INDUSTRIES.map((i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="secondaryIndustries"
                    value={i}
                    defaultChecked={user.secondaryIndustries.includes(i)}
                    className="h-4 w-4 rounded border-[var(--surface-border)]"
                  />
                  {INDUSTRY_LABELS[i]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            name="skills"
            label="Skills (comma separated)"
            defaultValue={user.skills.join(", ")}
          />

          <Field name="portfolioUrl" label="Portfolio URL" defaultValue={user.portfolioUrl ?? ""} />

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">Bio</span>
            <textarea
              name="bio"
              rows={4}
              defaultValue={user.bio ?? ""}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
          >
            Save profile
          </button>
        </form>
      </Card>
      </section>
    </EditSectionFrame>
  );
}
