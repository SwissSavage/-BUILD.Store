/**
 * Shared server action for the three signup-intent pages.
 *
 * Each page renders its own narrow form with a hidden `intent` input;
 * they all submit here. Pushing the form into HubSpot happens via the
 * CRM stub. REPLACE WITH real HubSpot lead create + pipeline routing
 * once `HUBSPOT_ACCESS_TOKEN` is provisioned per
 * deliverables/launch-prep/production-swap-checklist.md §6.
 */
"use server";

import { redirect } from "next/navigation";
import { createHubspotLead } from "@/lib/crm-stub";
import { pushInboundSubmission } from "@/lib/mock-data/inbound-submissions";
import { extractKeywords } from "@/lib/talent-match";
import type { Industry, InboundSubmissionKind } from "@/lib/types";
import type { SignupIntent } from "./_copy";

function readIntent(value: FormDataEntryValue | null): SignupIntent {
  const allowed: SignupIntent[] = [
    "hire_talent",
    "build_a_team",
    "join_as_talent",
  ];
  const v = String(value ?? "");
  return (allowed as string[]).includes(v)
    ? (v as SignupIntent)
    : "build_a_team";
}

const ALLOWED_PILLARS = new Set(["stem", "creative-media", "professional-services"]);

export async function handleSignup(formData: FormData) {
  const intent = readIntent(formData.get("intent"));

  // Multi-pillar (build_a_team). Filtered to the canonical Industry union.
  const pillars = formData
    .getAll("pillars")
    .map((v) => String(v))
    .filter((v) => ALLOWED_PILLARS.has(v));

  // JD uploads. Sandbox captures metadata only; production swap streams
  // the actual file bytes to object storage and persists the URLs.
  const jdUploads = formData
    .getAll("jdUploads")
    .filter((v): v is File => v instanceof File && v.size > 0)
    .map((f) => ({ name: f.name, size: f.size, type: f.type }));

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const opportunityBrief = String(formData.get("opportunityBrief") ?? "").trim();
  const teamScope = String(formData.get("teamScope") ?? "").trim();
  const talentPortfolioUrl = String(formData.get("talentPortfolioUrl") ?? "").trim();
  const talentSummary = String(formData.get("talentSummary") ?? "").trim();

  // Project the lead into the unified inbound queue so /admin/inbound
  // shows every form submission alongside RFPs, chats, and applications.
  const kindMap: Record<SignupIntent, InboundSubmissionKind> = {
    hire_talent: "hire_talent_signup",
    build_a_team: "build_team_signup",
    join_as_talent: "join_talent_signup",
  };
  const titlePrefix: Record<SignupIntent, string> = {
    hire_talent: "Hire talent",
    build_a_team: "$BUILD a team",
    join_as_talent: "Join as talent",
  };
  const body =
    opportunityBrief || teamScope || talentSummary || "(no detail provided)";
  const pillarFallback: Industry[] = (industry === "stem" ||
  industry === "creative-media" ||
  industry === "professional-services"
    ? [industry as Industry]
    : []);
  const resolvedPillars: Industry[] =
    pillars.length > 0 ? (pillars as Industry[]) : pillarFallback;
  pushInboundSubmission({
    kind: kindMap[intent],
    status: "new",
    title: `${titlePrefix[intent]} — ${firstName} ${lastName}`.trim(),
    submitter: `${firstName} ${lastName}`.trim() || email,
    submitterEmail: email || null,
    submitterCompany: company || null,
    pillarTags: resolvedPillars,
    keywordTags: extractKeywords(body),
    body,
    attachments: jdUploads,
    assignedAdminId: null,
    triageNote: null,
    deepLinkHref: null,
    derived: false,
  });

  await createHubspotLead({
    email,
    firstName,
    lastName,
    company,
    industry,
    intent,
    talentPortfolioUrl: talentPortfolioUrl || undefined,
    talentSummary: talentSummary || undefined,
    opportunityBrief: opportunityBrief || undefined,
    teamScope: teamScope || undefined,
    pillars: pillars.length > 0 ? pillars : undefined,
    jdUploads: jdUploads.length > 0 ? jdUploads : undefined,
    source: `signup_form_${intent}`,
    // Tier-2 data participation opt-in. Captured here at signup so the
    // production swap can persist it on the User row and write an audit
    // entry. Tier-1 (registration T&C) is implicit via form submission
    // since the checkbox is `required`.
    dataParticipationOptIn:
      String(formData.get("dataParticipation") ?? "") === "on",
  });

  redirect("/signup/thanks");
}
