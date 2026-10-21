/**
 * Small, unresolved-work counts for the Admin navigation. These are not
 * notification counts: a badge remains until the underlying record is acted on.
 */
import {
  consultationRequestReader,
  customerFeedbackReader,
  epkReader,
  feedbackReader,
  inboundReader,
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
    safely(() => inboundReader.all(), []),
  ]);

  const count = (value: number) => (value > 0 ? value : undefined);
  return {
    "/admin/inbound": count(inbound.filter((row) =>
      row.status === "new" || row.status === "in_triage" || row.status === "needs_info",
    ).length),
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
  };
}
