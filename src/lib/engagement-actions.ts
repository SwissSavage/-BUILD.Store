/**
 * Compose an engagement directly, with the lift on the admin and one
 * click on the Builder.
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
 * WHY THERE IS NO HOT START
 *
 * The first cut had one button: Start engagement. It created the deal,
 * set the project running, assigned the Builder and notified them, in
 * one press, off terms the Builder had never seen. Jamar: "I don't
 * think a raw hot start should be an option. That leaves open principal
 * agent problems and all that's needed really is one review and click
 * from talent."
 *
 * He is right, and the specific exposure is worth naming: FM would be
 * committing someone else's hours, at a rate they had not confirmed, to
 * a not-to-exceed ceiling they had never seen, to a client who was
 * already being told work had started. Every one of those is FM
 * speaking for the Builder. One review and one click closes all of it,
 * and the engagement being composed right now is the case in point:
 * the ceiling is unknown until Ozy says how long she needs.
 *
 * THE LIFT IS STILL ONE-SIDED
 *
 * The admin enters everything. The Builder is assigned rather than
 * asked to apply, and fills in nothing: they read one screen and press
 * Accept. The client is not asked to write a brief or post a contract.
 * The agreement is generated from what the admin already typed.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, projects } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { getUserById } from "@/lib/readers/users";
import { createHubspotLead, getHubspotCompany } from "@/lib/crm-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { notify } from "@/lib/writers/notifications";
import { sendTransactionalEmail } from "@/lib/email";
import { suggestedClientHourlyRate } from "@/lib/quote-pricing";
import {
  parseHubspotCompanyId,
  readEngagementFiles,
  readEngagementLinks,
  type EngagementFile,
  type EngagementLink,
} from "@/lib/engagement-references";
import { publicName, type Industry } from "@/lib/types";

export type ComposeEngagementResult =
  | { ok: true; projectId: string; talentName: string; emailed: boolean }
  | { ok: false; error: string };

export type EngagementDecisionResult =
  | { ok: true; state: "accepted" | "declined" }
  | { ok: false; error: string };

function appBaseUrl(): string {
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
}

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

/** Plain text, because this is read on a phone between two other jobs. */
function reviewEmailBody(input: {
  talentName: string;
  clientDisplayName: string;
  title: string;
  scope: string;
  terms: string;
  links: EngagementLink[];
  files: EngagementFile[];
  reviewUrl: string;
}): string {
  const refs = [
    ...input.links.map((l) => `  ${l.label}: ${l.url}`),
    ...input.files.map((f) => `  ${f.name} (attached on the review page)`),
  ];
  return [
    `${input.talentName},`,
    ``,
    `${input.clientDisplayName} wants you on this. Nothing is committed until you say yes.`,
    ``,
    `${input.title}`,
    `${input.scope}`,
    ``,
    `Terms: ${input.terms}`,
    ...(refs.length ? [``, `Reference material:`, ...refs] : []),
    ``,
    `Read it and accept or decline here:`,
    input.reviewUrl,
    ``,
    `If the rate or the hours are wrong, decline and say why. Nobody has`,
    `told the client work has started.`,
    ``,
    `Future Modern`,
  ].join("\n");
}

/** One line, the way it reads on the review screen and in the email. */
function describeTerms(input: {
  basis: string;
  clientRate: number;
  payout: number;
  ceiling: number | null;
}): string {
  if (input.basis === "fixed") {
    return `Fixed price. You are paid $${input.payout.toLocaleString()}.`;
  }
  const ceiling = input.ceiling
    ? ` Not to exceed ${input.ceiling} hours.`
    : " No hours cap set; tell us what you need and it goes in.";
  return `$${input.payout}/hr to you.${ceiling}`;
}

/**
 * Create the engagement in the awaiting-talent state and email the
 * Builder.
 *
 * Returns a result rather than throwing. Next redacts server action
 * errors in production and a thrown error re-renders the page from
 * server state, which on a form this long means losing everything
 * typed. That happened on the quote compiler and cost an afternoon.
 *
 * No HubSpot deal is created here. A deal for terms that get declined
 * is junk in the CRM that somebody has to go and close as lost, and the
 * deal is the record of work agreed, so it is created on acceptance.
 */
export async function composeEngagement(
  _prev: ComposeEngagementResult | null,
  formData: FormData,
): Promise<ComposeEngagementResult> {
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
  if (!talent.email) {
    return {
      ok: false,
      error: `${publicName(talent)} has no email address on file, so there is nobody to send the terms to.`,
    };
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
        error: `The client rate has to be at least $${floor}/hr. A Builder asking $${payout} is paid $${Math.round(
          floor * 0.85,
        )} under the standing rules, and $${floor} is what covers that with the cooperative's 15 percent.`,
      };
    }
  } else if (!Number.isFinite(typedClientRate) || typedClientRate <= 0) {
    return { ok: false, error: "Enter the fixed price." };
  } else if (Number.isFinite(payout) && payout > typedClientRate) {
    return {
      ok: false,
      error: `The Builder's share ($${payout}) is more than the client is paying ($${typedClientRate}).`,
    };
  }

  const ceiling = Number(ceilingRaw.replace(/[,\s]/g, ""));
  const hasCeiling = Number.isFinite(ceiling) && ceiling > 0;

  const { links, error: linkError } = readEngagementLinks(formData);
  if (linkError) return { ok: false, error: linkError };
  const { files, error: fileError } = await readEngagementFiles(formData);
  if (fileError) return { ok: false, error: fileError };

  const client = await resolveClient({
    clientId: String(formData.get("clientId") ?? "").trim(),
    hubspotCompanyId: parseHubspotCompanyId(
      String(formData.get("hubspotCompanyId") ?? ""),
    ),
    displayName: String(formData.get("clientDisplayName") ?? "").trim(),
    contactName: String(formData.get("clientContactName") ?? "").trim(),
    contactEmail: String(formData.get("clientContactEmail") ?? "").trim(),
    adminId: admin.id,
  });
  if (!client) {
    return { ok: false, error: "Pick an existing client or give the company a name." };
  }

  // status "open" rather than "in_progress": nobody has agreed to do
  // this yet. Safe against the two surfaces that list open projects —
  // one requires isRfp, the other kind "internal" — so a pending
  // engagement does not surface as work available to apply for.
  const now = new Date().toISOString();
  const projectId = `prj_${randomUUID()}`;
  // What the Builder is paid, persisted rather than re-derived, because
  // the review screen shows the Builder their own number and must never
  // show them the client rate. Hourly comes off the 85/15 split; fixed
  // takes the admin's figure when they gave one and the same split when
  // they did not.
  const builderPayout =
    basis === "hourly"
      ? Math.round(clientRate * 0.85)
      : Number.isFinite(payout) && payout > 0
        ? payout
        : Math.round(typedClientRate * 0.85);

  await db.insert(projects).values({
    id: projectId,
    title,
    description: scope,
    industry: (industryRaw || "professional-services") as Industry,
    skillsRequired: [],
    budget: basis === "fixed" ? String(typedClientRate) : "0",
    status: "open",
    clientId: client.displayName,
    clientRefId: client.id,
    assignedMemberIds: [talent.id],
    // Whoever composed it hears back about it. Without this the accept
    // or decline lands in nobody's notifications.
    adminUserIds: [admin.id],
    kind: "contract",
    isRfp: false,
    hubspotDealId: null,
    engagementBasis: basis,
    engagementRate: basis === "hourly" ? String(clientRate) : String(typedClientRate),
    engagementCeilingHours: hasCeiling ? String(ceiling) : null,
    engagementScope: scope,
    talentBaseAmount: String(builderPayout),
    engagementState: "awaiting_talent",
    engagementSentAt: now,
    engagementLinks: links,
    engagementAttachments: files,
    createdAt: now,
    updatedAt: now,
  } as typeof projects.$inferInsert);

  const terms = describeTerms({ basis, clientRate, payout: builderPayout, ceiling: hasCeiling ? ceiling : null });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "project.member_assigned",
    resourceKind: "project",
    resourceId: projectId,
    before: {},
    after: {
      composedDirectly: true,
      engagementState: "awaiting_talent",
      clientRefId: client.id,
      talentUserId: talent.id,
      basis,
      clientRate,
      builderPayout,
      ceilingHours: hasCeiling ? ceiling : null,
      referenceLinks: links.length,
      referenceFiles: files.length,
    },
  });

  await notify({
    userId: talent.id,
    kind: "project_application_decision",
    title: `Review the terms — ${title}`,
    body: `${client.displayName}. ${terms} Nothing starts until you accept.`,
    href: `/projects/${projectId}/review`,
  });

  // Best-effort. The in-app notification is already written, so a mail
  // outage delays the nudge rather than losing the engagement, and the
  // admin is told which of the two happened.
  let emailed = false;
  try {
    await sendTransactionalEmail({
      to: talent.email,
      subject: `${client.displayName} — review and accept: ${title}`,
      text: reviewEmailBody({
        talentName: talent.firstName ?? publicName(talent),
        clientDisplayName: client.displayName,
        title,
        scope,
        terms,
        links,
        files,
        reviewUrl: `${appBaseUrl()}/projects/${projectId}/review`,
      }),
    });
    emailed = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[engagement] review email failed", err);
  }

  revalidatePath("/admin/projects");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, projectId, talentName: talent.firstName ?? publicName(talent), emailed };
}

/**
 * The Builder's one click.
 *
 * Gated on being the assigned Builder, not on holding a link. This is a
 * server action, which is a public POST endpoint whose id is a content
 * hash: the gate on the review page protects the page and nothing else.
 */
export async function decideEngagementTerms(
  _prev: EngagementDecisionResult | null,
  formData: FormData,
): Promise<EngagementDecisionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to respond to these terms." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const reason = String(formData.get("declineReason") ?? "").trim();

  if (decision !== "accept" && decision !== "decline") {
    return { ok: false, error: "Accept or decline." };
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, error: "That engagement no longer exists." };

  const assigned = (project.assignedMemberIds ?? []) as string[];
  if (!assigned.includes(user.id)) {
    return { ok: false, error: "These terms are not addressed to you." };
  }
  if (project.engagementState !== "awaiting_talent") {
    return {
      ok: false,
      error:
        project.engagementState === "accepted"
          ? "You already accepted this one."
          : "This engagement is no longer open for a decision. Talk to your admin.",
    };
  }
  if (decision === "decline" && reason.length < 3) {
    return { ok: false, error: "Say what is wrong with it, even briefly. That is what gets fixed." };
  }

  const now = new Date().toISOString();

  if (decision === "decline") {
    await db
      .update(projects)
      .set({
        engagementState: "declined",
        engagementDecidedAt: now,
        engagementDeclineReason: reason.slice(0, 2000),
        status: "cancelled",
        updatedAt: now,
      })
      .where(eq(projects.id, projectId));

    await logAuditEvent({
      actorUserId: user.id,
      actorRoleSnapshot: snapshotActorRole(user),
      action: "project.member_assigned",
      resourceKind: "project",
      resourceId: projectId,
      before: { engagementState: "awaiting_talent" },
      after: { engagementState: "declined", reason: reason.slice(0, 2000) },
    });

    await notifyComposingAdmins(project.adminUserIds as string[], {
      title: `Declined — ${project.title}`,
      body: `${publicName(user)}: ${reason.slice(0, 160)}`,
      href: `/admin/projects`,
    });

    revalidatePath("/admin/projects");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, state: "declined" };
  }

  // Accepted. Now the deal exists, because now there is something
  // agreed for it to represent.
  let hubspotDealId: string | null = project.hubspotDealId ?? null;
  if (!hubspotDealId) {
    try {
      const [clientRow] = project.clientRefId
        ? await db
            .select({
              displayName: clients.displayName,
              contactName: clients.primaryContactName,
              contactEmail: clients.primaryContactEmail,
            })
            .from(clients)
            .where(eq(clients.id, project.clientRefId))
            .limit(1)
        : [];
      const lead = await createHubspotLead({
        email: clientRow?.contactEmail ?? "",
        firstName: clientRow?.contactName ?? "",
        lastName: "",
        company: clientRow?.displayName ?? project.clientId,
        industry: project.industry,
        intent: "hire_talent",
        opportunityBrief: `${project.title}\n\n${project.engagementScope ?? project.description}`,
        source: "direct_engagement",
        dataParticipationOptIn: false,
      });
      hubspotDealId = lead.dealId ?? null;
    } catch (err) {
      // A CRM outage must not stop agreed work from starting. The deal
      // can be linked afterwards; an engagement with no deal is
      // recoverable in a way that an unrecorded agreement is not.
      // eslint-disable-next-line no-console
      console.error("[engagement] HubSpot deal creation failed", err);
    }
  }

  await db
    .update(projects)
    .set({
      engagementState: "accepted",
      engagementDecidedAt: now,
      status: "in_progress",
      hubspotDealId,
      hubspotStage: "closed_won",
      updatedAt: now,
    })
    .where(eq(projects.id, projectId));

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "project.member_assigned",
    resourceKind: "project",
    resourceId: projectId,
    before: { engagementState: "awaiting_talent", status: "open" },
    after: { engagementState: "accepted", status: "in_progress", hubspotDealId },
  });

  await notifyComposingAdmins(project.adminUserIds as string[], {
    title: `Accepted — ${project.title}`,
    body: `${publicName(user)} accepted the terms. The client agreement can go out.`,
    href: `/projects/${projectId}`,
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, state: "accepted" };
}

async function notifyComposingAdmins(
  adminUserIds: string[],
  input: { title: string; body: string; href: string },
) {
  for (const id of adminUserIds ?? []) {
    await notify({
      userId: id,
      kind: "project_application_decision",
      title: input.title,
      body: input.body,
      href: input.href,
    });
  }
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
