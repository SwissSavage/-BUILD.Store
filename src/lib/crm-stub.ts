/**
 * ============================================================
 * STUB — HubSpot CRM integration.
 *
 * REPLACE WITH: real HubSpot calls (see legacy
 * `build-store-frontend/src/app/api/crm/util.ts` for the POST
 * shape used in production). Env var: HUBSPOT_ACCESS_TOKEN.
 *
 * Sandbox behavior:
 *   - Logs the payload to the server console.
 *   - Returns a fake deal id.
 * ============================================================
 */

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
   * applicant did not check the optional opt-in box. Production swap
   * persists this on the User row and writes an audit entry per
   * `lib/consent-actions.ts`.
   */
  dataParticipationOptIn?: boolean;
}

export interface SignupResult {
  contactId: string;
  dealId: string;
}

export async function createHubspotLead(
  payload: SignupPayload,
): Promise<SignupResult> {
  // eslint-disable-next-line no-console
  console.log("[crm-stub] would POST to HubSpot:", payload);
  const stamp = Date.now().toString(36);
  return {
    contactId: `stub_contact_${stamp}`,
    dealId: `stub_deal_${stamp}`,
  };
}

/**
 * Stub for the inbound HubSpot stage-change webhook (Phase 1.3).
 *
 * Production flow:
 *   1. HubSpot fires a `deal.propertyChange` webhook to /api/hooks/hubspot/stage
 *      whenever `dealstage` updates on a tracked deal.
 *   2. The handler verifies the HubSpot signature, looks up the matching
 *      Project by `hubspotDealId`, and writes the new stage onto
 *      `Project.hubspotStage`.
 *   3. Contributors assigned to the contract see the new stage on
 *      /dashboard the next time the page renders.
 *
 * Sandbox behavior:
 *   - Mutates MOCK_PROJECTS in memory and returns the new state.
 *   - No signature check (there's no real HubSpot wiring).
 */
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import type { HubspotStage } from "@/lib/types";

export async function applyHubspotStageWebhook(
  hubspotDealId: string,
  newStage: HubspotStage,
): Promise<{ updated: boolean; projectId: string | null }> {
  const project = MOCK_PROJECTS.find((p) => p.hubspotDealId === hubspotDealId);
  if (!project) {
    // eslint-disable-next-line no-console
    console.warn("[crm-stub] no project for HubSpot deal", hubspotDealId);
    return { updated: false, projectId: null };
  }
  project.hubspotStage = newStage;
  project.updatedAt = new Date().toISOString();
  return { updated: true, projectId: project.id };
}
