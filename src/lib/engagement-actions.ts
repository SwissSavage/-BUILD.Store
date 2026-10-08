/**
 * Start an engagement directly, in one pass, with the lift on the admin.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-08)
 *
 * Every path into work ran through an RFP: post it, dispatch it, take
 * bids, compile a quote, have the client choose. That is the right
 * shape for cold acquisition and the wrong shape for most of how FM
 * sells. A returning client asking for the person they worked with last
 * time had no route at all.
 *
 * What actually happens is a deal, a stage of closed-won, and work
 * starting. That is fine, and it is not the problem. The problem is
 * that the only record of what was agreed is a text message, which is
 * acceptable for a solo shop and a liability for the enterprise one FM
 * is building toward.
 *
 * So this does not slow the motion down. It produces the record at the
 * speed the motion already moves, from one screen, entered once.
 *
 * THE LIFT IS DELIBERATELY ONE-SIDED
 *
 * The admin enters everything. The Builder is assigned rather than
 * asked to apply. The client is not asked to write a brief or post a
 * contract. Neither of them fills in a form at any point: the agreement
 * is generated from what the admin already typed, and all they do is
 * sign it.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { getUserById } from "@/lib/readers/users";
import { createHubspotLead, getHubspotCompany } from "@/lib/crm-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { notify } from "@/lib/writers/notifications";
import { suggestedClientHourlyRate } from "@/lib/quote-pricing";
import type { Industry } from "@/lib/types";

export type StartEngagementResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

/**
 * Find or create the client record.
 *
 * Keyed on the HubSpot company when there is one, so picking the same
 * company twice links to one row rather than making a second. A
 * relationship with no CRM record yet still gets a row, because
 * refusing to record one until HubSpot knows about it would recreate
 * the blank-form problem this exists to remove.
 */
async function resolveClient(input: {
  clientId: string;
  hubspotCompanyId: string;
  displayName: string;
  contactName: string;
  contactEmail: string;
  adminId: string;
}): Promise<{ id: string; displayName: string } | null> {
  if (input.clientId) {
    const [existing] = await db
      .select({ id: clients.id, displayName: clients.displayName })
      .from(clients)
      .where(eq(clients.id, input.clientId))
      .limit(1);
    if (existing) return existing;
  }

  if (input.hubspotCompanyId) {
    const [linked] = await db
      .select({ id: clients.id, displayName: clients.displayName })
      .from(clients)
      .where(eq(clients.hubspotCompanyId, input.hubspotCompanyId))
      .limit(1);
    if (linked) return linked;
  }

  // The name HubSpot holds beats the one typed into the box, when both
  // exist, so the record matches the CRM rather than drifting from it.
  let displayName = input.displayName.trim();
  if (input.hubspotCompanyId) {
    const company = await getHubspotCompany(input.hubspotCompanyId);
    if (company?.name) displayName = company.name;
  }
  if (displayName.length < 2) return null;

  const row = {
    id: `cl_${randomUUID()}`,
    displayName,
    hubspotCompanyId: input.hubspotCompanyId || null,
    primaryContactName: input.contactName.trim() || null,
    primaryContactEmail: input.contactEmail.trim().toLowerCase() || null,
    status: "active" as const,
    notes: null,
    createdAt: new Date().toISOString(),
    createdByUserId: input.adminId,
  };
  await db.insert(clients).values(row);
  return { id: row.id, displayName };
}

/**
 * Create the engagement, the deal and the assignment together.
 *
 * Returns a result rather than throwing. Next redacts server action
 * errors in production and a thrown error re-renders the page from
 * server state, which on a form this long means losing everything
 * typed. That happened on the quote compiler and cost an afternoon.
 */
export async function startDirectEngagement(
  _prev: StartEngagementResult | null,
  formData: FormData,
): Promise<StartEngagementResult> {
  const admin = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const scope = String(formData.get("engagementScope") ?? "").trim();
  const talentUserId = String(formData.get("talentUserId") ?? "").trim();
  const industryRaw = String(formData.get("industry") ?? "").trim();
  const basis = String(formData.get("engagementBasis") ?? "hourly").trim();
  const payoutRaw = String(formData.get("builderPayoutRate") ?? "").trim();
  const clientRateRaw = String(formData.get("engagementRate") ?? "").trim();
  const ceilingRaw = String(formData.get("engagementCeilingHours") ?? "").trim();

  if (title.length < 3) {
    return { ok: false, error: "Give the engagement a name the client would recognise." };
  }
  if (scope.length < 10) {
    return { ok: false, error: "Write a line or two of scope. It is what the agreement is generated from." };
  }
  if (basis !== "hourly" && basis !== "fixed") {
    return { ok: false, error: "Pick hourly or fixed." };
  }

  const talent = talentUserId ? await getUserById(talentUserId) : null;
  if (!talent) {
    return { ok: false, error: "Pick the Builder doing the work." };
  }

  // The standing rules apply here exactly as they do on a quote: $10
  // over a Builder's own number, never under a $50/hr payout. An
  // engagement started directly must not quietly pay worse than one
  // won through a bid.
  const payout = Number(payoutRaw.replace(/[$,\s]/g, ""));
  const typedClientRate = Number(clientRateRaw.replace(/[$,\s]/g, ""));
  let clientRate = typedClientRate;
  if (basis === "hourly") {
    if (!Number.isFinite(payout) || payout <= 0) {
      return { ok: false, error: "Enter what the Builder is asking per hour." };
    }
    const floor = suggestedClientHourlyRate(payout);
    if (!Number.isFinite(clientRate) || clientRate <= 0) clientRate = floor;
    if (clientRate < floor) {
      return {
        ok: false,
        error: `Client rate is below the $${floor}/hr the standing rules give this Builder.`,
      };
    }
  }

  const ceiling = Number(ceilingRaw.replace(/[,\s]/g, ""));
  const hasCeiling = Number.isFinite(ceiling) && ceiling > 0;

  const client = await resolveClient({
    clientId: String(formData.get("clientId") ?? "").trim(),
    hubspotCompanyId: String(formData.get("hubspotCompanyId") ?? "").trim(),
    displayName: String(formData.get("clientDisplayName") ?? "").trim(),
    contactName: String(formData.get("clientContactName") ?? "").trim(),
    contactEmail: String(formData.get("clientContactEmail") ?? "").trim(),
    adminId: admin.id,
  });
  if (!client) {
    return { ok: false, error: "Pick an existing client or give the company a name." };
  }

  // Best-effort. A CRM outage must not stop work being recorded; the
  // deal can be linked afterwards, and an engagement with no deal is
  // recoverable in a way as an engagement with no record is not.
  let hubspotDealId: string | null = null;
  try {
    const lead = await createHubspotLead({
      email: String(formData.get("clientContactEmail") ?? "").trim(),
      firstName: String(formData.get("clientContactName") ?? "").trim(),
      lastName: "",
      company: client.displayName,
      industry: industryRaw,
      intent: "hire_talent",
      opportunityBrief: `${title}\n\n${scope}`,
      source: "direct_engagement",
      dataParticipationOptIn: false,
    });
    hubspotDealId = lead.dealId ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[engagement] HubSpot deal creation failed", err);
  }

  const now = new Date().toISOString();
  const projectId = `prj_${randomUUID()}`;
  await db.insert(projects).values({
    id: projectId,
    title,
    description: scope,
    industry: (industryRaw || "professional-services") as Industry,
    skillsRequired: [],
    budget: basis === "fixed" ? String(typedClientRate || 0) : "0",
    status: "in_progress",
    clientId: client.displayName,
    clientRefId: client.id,
    assignedMemberIds: [talent.id],
    kind: "contract",
    isRfp: false,
    hubspotDealId,
    engagementBasis: basis,
    engagementRate: basis === "hourly" ? String(clientRate) : String(typedClientRate || 0),
    engagementCeilingHours: hasCeiling ? String(ceiling) : null,
    engagementScope: scope,
    createdAt: now,
    updatedAt: now,
  } as typeof projects.$inferInsert);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "project.member_assigned",
    resourceKind: "project",
    resourceId: projectId,
    before: {},
    after: {
      startedDirectly: true,
      clientRefId: client.id,
      hubspotDealId,
      talentUserId: talent.id,
      basis,
      clientRate,
      ceilingHours: hasCeiling ? ceiling : null,
    },
  });

  await notify({
    userId: talent.id,
    kind: "project_application_decision",
    title: `You're on — ${title}`,
    body: hasCeiling
      ? `${client.displayName}. Not to exceed ${ceiling} hours; tell us before you approach it.`
      : `${client.displayName}. No hours cap agreed yet.`,
    href: `/projects/${projectId}`,
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, projectId };
}

/**
 * Client suggestions for the picker.
 *
 * Local rows first, because a client already recorded here is the one
 * an admin means nine times out of ten and needs no network call.
 */
export async function suggestClients(
  query: string,
): Promise<{ id: string; displayName: string; hubspotCompanyId: string | null }[]> {
  await requireAdmin();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await db
    .select({
      id: clients.id,
      displayName: clients.displayName,
      hubspotCompanyId: clients.hubspotCompanyId,
    })
    .from(clients)
    .where(and(eq(clients.status, "active"))!);
  return rows
    .filter((r) => r.displayName.toLowerCase().includes(q))
    .slice(0, 10);
}
