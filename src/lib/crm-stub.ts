/**
 * ============================================================
 * HubSpot CRM integration — live.
 *
 * Was a sandbox stub (see git history for the old console.log version).
 * Now makes real HubSpot v3 API calls using `HUBSPOT_ACCESS_TOKEN`.
 * Endpoint shapes lifted from the legacy production code at
 * `build-store-frontend/src/app/api/crm/util.ts` + `route.ts`, extended
 * to cover the richer `SignupPayload` this app collects (industry,
 * intent, pillars, talent/opportunity detail, JD upload metadata,
 * Tier-2 data-participation opt-in).
 *
 * Property note (checked live against the connected portal, July 2026):
 * only `firstname`, `lastname`, `email`, `company`, `industry`, and
 * `hs_lead_status` exist as contact properties out of the box. No
 * custom properties (signup_intent, pillars, talent_portfolio_url,
 * etc.) have been created in this portal yet. Rather than requiring a
 * round of custom-property provisioning before this can ship, the
 * intent/pillars/talent/opportunity detail all fold into the Deal's
 * `description` field as structured plain text — same pattern the
 * legacy code used for `project_description`. If/when custom contact
 * or deal properties get created in HubSpot, promote the relevant
 * fields out of the description blob and into real properties.
 *
 * Pipeline note: this portal only has the default "Sales Pipeline"
 * (`pipeline: "default"`) with HubSpot's stock stages
 * (appointmentscheduled → qualifiedtobuy → presentationscheduled →
 * decisionmakerboughtin → contractsent → closedwon/closedlost). The
 * legacy `HUBSPOT_DEAL_TYPE_ID_INITIAL_OUTREACH` constant
 * ("1439001328") does NOT match any real stage in this portal — it was
 * either a different portal's custom stage ID or stale. New deals from
 * signups land on `appointmentscheduled` (first stage in the stock
 * pipeline). See `mapHubspotStageToAppStage` below for how real
 * HubSpot stage values get translated into this app's simplified
 * `HubspotStage` enum for the contributor-facing badge.
 * ============================================================
 */

import type { HubspotStage } from "@/lib/types";

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BASE = "https://api.hubapi.com";
const HUBSPOT_CONTACT_ENDPOINT = `${BASE}/crm/v3/objects/contacts`;
const HUBSPOT_DEALS_ENDPOINT = `${BASE}/crm/v3/objects/deals`;

/** HubSpot's default association type ID for "Deal to Contact" (HUBSPOT_DEFINED). */
const ASSOCIATION_TYPE_DEAL_TO_CONTACT = 3;

export interface SignupPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  industry?: string;
  intent?: "hire_talent" | "build_a_team" | "join_as_talent";
  source?: string;
  /** Join-as-talent: URL to a resume or portfolio. */
  talentPortfolioUrl?: string;
  /** Join-as-talent: free-text summary or links. */
  talentSummary?: string;
  /** Hire-talent: JD / opportunity description. */
  opportunityBrief?: string;
  /** Build-a-team: team composition + scope. */
  teamScope?: string;
  /**
   * Build-a-team: discipline pillars the cross-pillar squad needs to
   * cover. Always sent as an array even when only one pillar was picked.
   * Allowed values mirror the `Industry` union.
   */
  pillars?: string[];
  /**
   * Uploaded JD / role-spec files (metadata only at sandbox stage).
   * Production swap pushes the actual files to object storage and
   * persists URLs against the deal in HubSpot.
   */
  jdUploads?: Array<{ name: string; size: number; type: string }>;
  /**
   * Tier-2 data participation opt-in captured at signup. False when the
   * applicant did not check the optional opt-in box.
   */
  dataParticipationOptIn?: boolean;
}

export interface SignupResult {
  contactId: string;
  dealId: string;
}

const INTENT_LABELS: Record<NonNullable<SignupPayload["intent"]>, string> = {
  hire_talent: "Hire talent",
  build_a_team: "$BUILD a team",
  join_as_talent: "Join as talent",
};

function buildDealDescription(payload: SignupPayload): string {
  const lines: string[] = [];
  if (payload.intent) {
    lines.push(`Intent: ${INTENT_LABELS[payload.intent]}`);
  }
  if (payload.pillars && payload.pillars.length > 0) {
    lines.push(`Pillars: ${payload.pillars.join(", ")}`);
  }
  if (payload.opportunityBrief) {
    lines.push(`Opportunity brief: ${payload.opportunityBrief}`);
  }
  if (payload.teamScope) {
    lines.push(`Team scope: ${payload.teamScope}`);
  }
  if (payload.talentSummary) {
    lines.push(`Talent summary: ${payload.talentSummary}`);
  }
  if (payload.talentPortfolioUrl) {
    lines.push(`Portfolio: ${payload.talentPortfolioUrl}`);
  }
  if (payload.jdUploads && payload.jdUploads.length > 0) {
    const files = payload.jdUploads
      .map((f) => `${f.name} (${Math.round(f.size / 1024)}KB)`)
      .join(", ");
    lines.push(`JD uploads: ${files}`);
  }
  if (payload.source) {
    lines.push(`Source: ${payload.source}`);
  }
  lines.push(
    `Tier-2 data participation opt-in: ${payload.dataParticipationOptIn ? "yes" : "no"}`,
  );
  return lines.join("\n");
}

interface HubspotApiObjectResponse {
  id: string;
  status?: string;
  properties?: Record<string, string | null>;
}

async function hubspotFetch(
  url: string,
  body: unknown,
): Promise<HubspotApiObjectResponse> {
  if (!HUBSPOT_ACCESS_TOKEN) {
    throw new Error(
      "HUBSPOT_ACCESS_TOKEN is not set in the deployment environment.",
    );
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as HubspotApiObjectResponse;
  if (!response.ok || json.status === "error") {
    // eslint-disable-next-line no-console
    console.error("[crm] HubSpot API error", response.status, json);
    throw new Error(`HubSpot API error (${response.status})`);
  }
  return json;
}

export async function createHubspotLead(
  payload: SignupPayload,
): Promise<SignupResult> {
  const contact = await hubspotFetch(HUBSPOT_CONTACT_ENDPOINT, {
    properties: {
      firstname: payload.firstName || undefined,
      lastname: payload.lastName || undefined,
      email: payload.email,
      company: payload.company || undefined,
      industry: payload.industry || undefined,
      hs_lead_status: "NEW",
    },
  });

  const firstName = payload.firstName || payload.email;
  const intentLabel = payload.intent ? INTENT_LABELS[payload.intent] : "Inbound Lead";
  const deal = await hubspotFetch(HUBSPOT_DEALS_ENDPOINT, {
    properties: {
      dealname: `${firstName} — ${intentLabel}`,
      pipeline: "default",
      dealstage: "appointmentscheduled",
      dealtype: "newbusiness",
      description: buildDealDescription(payload),
    },
    associations: [
      {
        to: { id: contact.id },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: ASSOCIATION_TYPE_DEAL_TO_CONTACT,
          },
        ],
      },
    ],
  });

  return { contactId: contact.id, dealId: deal.id };
}

/**
 * Translates a real HubSpot deal-stage value (from this portal's stock
 * "Sales Pipeline") into the app's simplified, contributor-facing
 * `HubspotStage` enum. Contributors never see raw HubSpot stage names —
 * just the five-bucket summary — so this mapping is the only place that
 * needs updating if the pipeline's stages ever change.
 */
export function mapHubspotStageToAppStage(
  rawStage: string,
): HubspotStage | null {
  switch (rawStage) {
    case "appointmentscheduled":
    case "qualifiedtobuy":
      return "discovery";
    case "presentationscheduled":
    case "decisionmakerboughtin":
      return "negotiation";
    case "contractsent":
      return "proposal_sent";
    case "closedwon":
      return "closed_won";
    case "closedlost":
      return "closed_lost";
    default:
      return null;
  }
}

/**
 * Inbound HubSpot stage-change webhook handler (Phase 1.3).
 *
 * Production flow:
 *   1. HubSpot fires a `deal.propertyChange` webhook to
 *      /api/hooks/hubspot/stage whenever `dealstage` updates on a
 *      tracked deal (see that route for signature verification + the
 *      HubSpot payload shape).
 *   2. The route maps the raw HubSpot stage via
 *      `mapHubspotStageToAppStage` and calls this function, which looks
 *      up the matching Project by `hubspotDealId` and writes the new
 *      stage onto `Project.hubspotStage`.
 *   3. Contributors assigned to the contract see the new stage on
 *      /dashboard the next time the page renders.
 *
 * Sandbox behavior (current — no Drizzle/Postgres yet):
 *   - Mutates MOCK_PROJECTS in memory and returns the new state.
 */
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";

export async function applyHubspotStageWebhook(
  hubspotDealId: string,
  newStage: HubspotStage,
): Promise<{ updated: boolean; projectId: string | null }> {
  const project = MOCK_PROJECTS.find((p) => p.hubspotDealId === hubspotDealId);
  if (!project) {
    // eslint-disable-next-line no-console
    console.warn("[crm] no project for HubSpot deal", hubspotDealId);
    return { updated: false, projectId: null };
  }
  project.hubspotStage = newStage;
  project.updatedAt = new Date().toISOString();
  return { updated: true, projectId: project.id };
}
