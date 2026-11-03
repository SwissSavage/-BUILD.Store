/**
 * Apply to a public role without an account.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03)
 *
 * /jobs/[id] rendered the whole brief to everyone and then told
 * signed-out readers to sign in to see the brief and apply. The brief
 * was already on screen. The only thing actually behind the gate was
 * the apply form, so the page was turning away the exact person the
 * posting was written for, with a reason that was not true.
 *
 * Jamar: "We should be able to allow visitors to apply for jobs...
 * as part of their application." One form. Applying to the role is
 * also the membership application, because the role is the top of the
 * funnel and asking someone to apply twice is how you lose the good
 * ones.
 *
 * WHY THIS IS NOT A job_applications ROW
 *
 * job_applications.user_id is NOT NULL and references users.id. A
 * visitor has no user row, and the two bad ways to force one are
 * dropping the foreign key or minting a placeholder account from an
 * unauthenticated POST. The first breaks a real relation for every
 * other caller; the second lets anyone create users.
 *
 * So the application lands in inbound_submissions, which already is
 * the triage queue for every other public form, carries the job on
 * linkedResourceId, and deep-links back to the posting. On approval
 * the existing invite flow runs and the person becomes a member who
 * can hold a real job_applications row. Nothing new to learn: the
 * admin reviews it at /admin/inbound alongside everything else.
 *
 * PUBLIC BY DESIGN
 *
 * A module-level "use server" publishes every export as a POST
 * endpoint, so this one is listed in LIB_PUBLIC in
 * scripts/check-server-action-auth.mjs with its reason. It writes one
 * triage row, creates no account, grants nothing, and returns the same
 * answer whether or not the email is already known, so it cannot be
 * used to enumerate members.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { insertInboundSubmission } from "@/lib/writers/inbound-submissions";
import { extractKeywords } from "@/lib/talent-match";
import { createHubspotLead } from "@/lib/crm-stub";

export interface VisitorApplicationResult {
  ok: boolean;
  message: string;
}

/** Same shape of answer for every outcome the submitter can see. */
const THANKS =
  "Application received. You will hear from Future Modern directly, and this also puts you forward for membership so you can be routed to future roles.";

export async function submitVisitorJobApplication(
  formData: FormData,
): Promise<VisitorApplicationResult> {
  const jobId = String(formData.get("jobId") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const portfolioLink = String(formData.get("portfolioLink") ?? "").trim();
  const desiredCompensation = String(
    formData.get("desiredCompensation") ?? "",
  ).trim();

  if (!jobId) {
    return {
      ok: false,
      message: "Missing role reference. Reload the page and try again.",
    };
  }
  if (name.length < 2) {
    return { ok: false, message: "Add your name so this can be routed." };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "That email address does not look right." };
  }
  if (pitch.length < 20) {
    return {
      ok: false,
      message:
        "Pitch is too short. Write at least a couple of sentences so this can be routed properly.",
    };
  }

  // The body an admin reads in triage. Plain text on purpose: this is
  // evidence of what the applicant actually wrote, not a rich document
  // to be re-rendered.
  const body = [
    `Applied to: ${jobTitle || jobId}`,
    "",
    pitch,
    "",
    portfolioLink ? `Portfolio: ${portfolioLink}` : null,
    desiredCompensation ? `Desired compensation: ${desiredCompensation}` : null,
    "",
    "Submitted from the public role posting with no account. Approving this issues an invite; the role application carries over once they are in.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  await insertInboundSubmission({
    kind: "job_application",
    status: "new",
    title: `${name} applied to ${jobTitle || jobId}`,
    submitter: name,
    submitterEmail: email,
    submitterCompany: null,
    pillarTags: [],
    // Derived only. A visitor cannot self-assign canonical tags, same
    // rule the signup intake follows.
    keywordTags: [],
    proposedKeywordTags: extractKeywords(
      `${pitch} ${portfolioLink}`,
    ).slice(0, 20),
    body,
    attachments: [],
    // Unassigned on purpose. A dangling id would violate the users
    // foreign key and reject the whole row; triage picks the owner.
    assignedAdminId: null,
    triageNote: null,
    deepLinkHref: `/jobs/${jobId}`,
    linkedResourceId: jobId,
    derived: false,
  });

  // Best-effort. A CRM outage must not cost us the application, which
  // is already committed above.
  try {
    await createHubspotLead({
      email,
      firstName: name.split(/\s+/)[0] ?? name,
      lastName: name.split(/\s+/).slice(1).join(" "),
      intent: "join_as_talent",
      source: `job:${jobId}`,
      talentPortfolioUrl: portfolioLink || undefined,
      talentSummary: pitch,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[visitor-application] createHubspotLead failed:", err);
  }

  return { ok: true, message: THANKS };
}
