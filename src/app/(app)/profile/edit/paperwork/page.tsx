/**
 * /profile/edit/paperwork — Paperwork.
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

export default async function PaperworkEditPage() {
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
    <EditSectionFrame active="paperwork" title="Paperwork" handle={user.handle}>
      <section id="paperwork" className="scroll-mt-24">
      <Card className="mt-6 border-[#5070F0]/40">
        <CardEyebrow>Data participation</CardEyebrow>
        <h2 className="mt-1 font-display text-xl font-semibold">
          Labor-value research opt-in
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          When you opt in, the cooperative includes your engagement data
          in the anonymized aggregates we publish as labor-value research
          and use as inputs to collective-bargaining tooling. Worker-side
          aligned by covenant. Raw price points never leave; anonymized
          only. Opt out anytime. Read the{" "}
          <Link
            href="/data-use-policy"
            className="text-brand-magenta hover:underline"
          >
            Data Use Policy
          </Link>{" "}
          for the full scope.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              backgroundColor: user.dataParticipation
                ? "rgba(0, 112, 72, 0.12)"
                : "rgba(102, 102, 102, 0.12)",
              color: user.dataParticipation ? "#007048" : "#666666",
            }}
          >
            {user.dataParticipation ? "Opted in" : "Not opted in"}
          </span>
          {user.dataParticipation ? (
            <form action={optOutDataParticipation}>
              <button
                type="submit"
                className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
              >
                Opt out
              </button>
            </form>
          ) : (
            <form action={optInDataParticipation}>
              <button
                type="submit"
                className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "#5070F0" }}
              >
                Opt in
              </button>
            </form>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Tier-1 operational use (internal pricing, matching, calibration)
          is governed by your registration terms and is not affected by
          this toggle.
        </p>
      </Card>

      {/* Task #27 — Documenso account perk. Partner + Member only. */}
      {(user.membershipTier === "partner" ||
        user.membershipTier === "member") && (
        <Card className="mt-6 border-brand-magenta/40">
          <CardEyebrow>Perk · Documenso account</CardEyebrow>
          {user.documensoAccountLinkedAt ? (
            <p className="mt-2 text-sm text-ink-muted">
              Your Documenso account is linked. Send and track your
              own signed documents at{" "}
              <a
                href={
                  process.env.NEXT_PUBLIC_DOCUMENSO_BASE_URL ??
                  "https://sign.afuturemodern.com"
                }
                target="_blank"
                rel="noreferrer"
                className="text-brand-magenta hover:underline"
              >
                sign.afuturemodern.com
              </a>
              .
            </p>
          ) : user.documensoInvitedAt ? (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                Your invite went out on{" "}
                {new Date(user.documensoInvitedAt).toLocaleDateString()}
                . Check your inbox notification for the claim link.
                Once you complete signup, come back and confirm below.
              </p>
              <form action={claimDocumensoAccount} className="mt-3">
                <button
                  type="submit"
                  className="rounded-full border border-brand-magenta px-4 py-1.5 text-xs font-medium text-brand-magenta hover:bg-brand-magenta hover:text-white"
                >
                  I've claimed my account
                </button>
              </form>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              You're eligible for a free Documenso account through
              Future Modern. Ask an admin to send you the claim link,
              or wait — the invite lands in your inbox once processed.
            </p>
          )}
        </Card>
      )}

      {(() => {
        return (
          <Card className="mt-6">
            <CardEyebrow>Paperwork on file</CardEyebrow>
            <h2 className="mt-1 font-display text-xl font-semibold">
              Your signed agreements
            </h2>
            <p className="mt-2 max-w-prose text-sm text-ink-muted">
              Everything you have signed with the cooperative. Every
              row here is one signature event — if a covenant gets
              revised and you re-sign, a new row appears while the
              old one stays for the historical record. If something
              looks wrong, message an admin.
            </p>
            {myAgreements.length === 0 ? (
              <p className="mt-4 text-sm text-ink-faint">
                Nothing on file yet.
              </p>
            ) : (
              <ol className="mt-4 space-y-2">
                {myAgreements.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3 text-xs"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {AGREEMENT_TYPE_LABELS[a.agreementType]}{" "}
                        <span className="text-ink-faint">
                          v{a.version}
                        </span>
                      </span>
                      <span
                        className="font-mono text-[10px] text-ink-faint"
                        title={a.signedAt}
                      >
                        {a.signedAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {AGREEMENT_PROVIDER_LABELS[a.provider]}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        );
      })()}

      </section>
    </EditSectionFrame>
  );
}
