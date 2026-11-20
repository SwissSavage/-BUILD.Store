/**
 * Small, unresolved-work counts for the Admin navigation. These are not
 * notification counts: a badge remains until the underlying record is acted on.
 */
import {
  consultationRequestReader,
  customerFeedbackReader,
  epkReader,
  feedbackReader,
  jobApplicationReader,
  membershipApplicationReader,
  portfolioReader,
  prospectiveContributionReader,
  quoteSheetReader,
  sellerApplicationReader,
  safely,
  whitelistPurchaseReader,
  productReader,
} from "@/lib/readers";
import { getAllApplications } from "@/lib/readers/project-applications";
import { getPendingSplits } from "@/lib/readers";
import { count as sqlCount, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { inboundSubmissions } from "@/db/schema";
import type { AdminQueueCounts } from "@/lib/admin-nav";

export type { AdminQueueCounts } from "@/lib/admin-nav";

export async function getAdminQueueCounts(): Promise<AdminQueueCounts> {
  const [
    membershipApplications,
    projectApplications,
    jobApplications,
    contributions,
    quoteSheets,
    sellerApplications,
    products,
    whitelistPurchases,
    consultations,
    portfolios,
    epks,
    feedback,
    testimonials,
    inbound,
    pendingSplits,
  ] = await Promise.all([
    safely(() => membershipApplicationReader.all(), []),
    safely(() => getAllApplications(), []),
    safely(() => jobApplicationReader.all(), []),
    safely(() => prospectiveContributionReader.all(), []),
    safely(() => quoteSheetReader.all(), []),
    safely(() => sellerApplicationReader.all(), []),
    safely(() => productReader.all(), []),
    safely(() => whitelistPurchaseReader.all(), []),
    safely(() => consultationRequestReader.all(), []),
    safely(() => portfolioReader.all(), []),
    safely(() => epkReader.all(), []),
    safely(() => feedbackReader.all(), []),
    safely(() => customerFeedbackReader.all(), []),
    safely(async () => {
      const [result] = await db.select({ value: sqlCount() }).from(inboundSubmissions).where(inArray(inboundSubmissions.status, ["new", "in_triage", "needs_info"]));
      return result.value;
    }, 0),
    // Money owed and not yet sent. Added 2026-11-18 after the AWS
    // settlement sat in "Awaiting manual send" with nothing anywhere
    // saying so: the only way to know was to open the page and look.
    //
    // Jamar: "a notification in Admin payments would be helpful if
    // that's where it lands. It should be accessible through multiple
    // entries."
    //
    // It is one line because of how this file is keyed. Counts are
    // keyed by Admin DESTINATION, so a number here badges the nav
    // dropdown, the mobile menu and the admin home tile at once.
    // Nothing else needs touching.
    safely(() => getPendingSplits(), []),
  ]);

  const count = (value: number) => (value > 0 ? value : undefined);
  return {
    "/admin/inbound": count(inbound),
    "/admin/applications": count(membershipApplications.filter((row) => row.status === "pending").length),
    "/admin/projects/applications": count(projectApplications.filter((row) => row.status === "pending").length),
    "/admin/jobs/applications": count(jobApplications.filter((row) => row.status === "pending").length),
    "/admin/projects/contributions": count(contributions.filter((row) => row.status === "new" || row.status === "contacted").length),
    "/admin/quotes": count(quoteSheets.filter((row) => !row.approvedAt && !row.rejectedAt).length),
    "/admin/marketplace": count(
      sellerApplications.filter((row) => row.status === "pending").length +
        products.filter((row) => row.status === "pending_review").length,
    ),
    "/admin/whitelist": count(
      whitelistPurchases.filter((row) => row.status === "initiated" || row.status === "paid").length +
        consultations.filter((row) => row.status === "new").length,
    ),
    "/admin/portfolios": count(portfolios.filter((row) => !row.publishedAt && !row.rejectedAt).length),
    "/admin/epk": count(epks.filter((row) => row.status === "submitted").length),
    "/admin/testimonials": count(testimonials.filter((row) => row.publishedAt === null).length),
    "/admin/feedback": count(feedback.filter((row) => row.status === "new").length),
    // Unlike the queues above, this one is money that has been
    // promised to somebody and not yet moved. It stays lit until an
    // admin records the send, which is the behaviour the header of
    // this file describes: a badge remains until the underlying
    // record is acted on.
    "/admin/payments": count(pendingSplits.length),
  };
}
