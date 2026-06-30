/**
 * Unified inbound submissions store.
 *
 * Sandbox mirror of the production `inbound_submissions` table. Every
 * writer (signup actions, RFP intake, partner application, chat
 * creation, custom quote request, store inquiry) pushes a row here so
 * `/admin/inbound` shows a single triage queue across all surfaces.
 *
 * Some rows are persisted directly via `pushInboundSubmission()`; others
 * are derived from existing canonical stores (RFPs from MOCK_PROJECTS,
 * chat threads from the chat store) at read time so the admin queue
 * stays in sync without double-writes during the sandbox phase.
 *
 * REPLACE WITH: Drizzle `inbound_submissions` table. The aggregation
 * helpers below collapse into a single SELECT with UNION ALL or a
 * materialized view.
 */
import type {
  InboundSubmission,
  InboundSubmissionKind,
  InboundSubmissionStatus,
} from "@/lib/types";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { listThreads as listChatThreads } from "@/lib/mock-data/chat";
import { MOCK_APPLICATIONS } from "@/lib/mock-data/applications";
import { MOCK_QUOTES } from "@/lib/mock-data/quotes";
import { MOCK_USERS } from "@/lib/mock-data/users";

/** Persisted submissions (sandbox seeds + runtime writes). */
export const MOCK_INBOUND_SUBMISSIONS: InboundSubmission[] = [
  {
    id: "in_001",
    kind: "build_team_signup",
    status: "new",
    title: "Cross-pillar squad for DTC apparel launch",
    submitter: "Maya Lin",
    submitterEmail: "maya@laceandsteel.example",
    submitterCompany: "Lace & Steel",
    pillarTags: ["creative-media", "stem", "professional-services"],
    keywordTags: [
      "dtc",
      "apparel",
      "shopify",
      "brand-system",
      "fulfillment",
      "ops",
    ],
    body:
      "Need a 3-person squad to stand up a DTC apparel brand: brand system, Shopify build, fulfillment ops. 10-week runway to first drop.",
    attachments: [
      { name: "lace-steel-brief.pdf", size: 188_400, type: "application/pdf" },
    ],
    assignedAdminId: null,
    triageNote: null,
    deepLinkHref: null,
    derived: false,
    createdAt: "2026-05-16T15:23:00Z",
    updatedAt: "2026-05-16T15:23:00Z",
  },
  {
    id: "in_002",
    kind: "hire_talent_signup",
    status: "in_triage",
    title: "Senior brand designer, 6-week rebrand",
    submitter: "Jonas Park",
    submitterEmail: "jonas@noteworthy.example",
    submitterCompany: "Noteworthy",
    pillarTags: ["creative-media"],
    keywordTags: ["brand-designer", "rebrand", "series-a", "legaltech"],
    body:
      "Senior brand designer, 6-week engagement, rebranding a Series A legaltech company. Budget $40-60k. Start in 3 weeks.",
    attachments: [],
    assignedAdminId: "u_jamar",
    triageNote: "Reassigned to Jamar 2026-06-29 (prior assignee out per bylaws). Asking BBG to scope.",
    deepLinkHref: null,
    derived: false,
    createdAt: "2026-05-15T09:45:00Z",
    updatedAt: "2026-05-16T11:10:00Z",
  },
  {
    id: "in_003",
    kind: "partner_application",
    status: "needs_info",
    title: "Channel partner inquiry — Reach",
    submitter: "Daniel Reyes",
    submitterEmail: null,
    submitterCompany: "Reach",
    pillarTags: ["professional-services"],
    keywordTags: ["channel-partner", "lead-routing"],
    body:
      "Reach reached out about a channel relationship — FM as their channel partner. $500 upfront + revenue share. Need to push back on the MLM-shaped terms.",
    attachments: [],
    assignedAdminId: "u_jamar",
    triageNote:
      "We are open to working AS channel partners ourselves; rejected the inbound shape. Re-engaging on Day-1 cut structure.",
    deepLinkHref: null,
    derived: false,
    createdAt: "2026-05-14T17:02:00Z",
    updatedAt: "2026-05-16T14:00:00Z",
  },
];

export function pushInboundSubmission(
  partial: Omit<InboundSubmission, "id" | "createdAt" | "updatedAt">,
): InboundSubmission {
  const id = `in_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
  const now = new Date().toISOString();
  const row: InboundSubmission = {
    ...partial,
    id,
    createdAt: now,
    updatedAt: now,
  };
  MOCK_INBOUND_SUBMISSIONS.push(row);
  return row;
}

/**
 * Derive read-only rows from RFP projects, chat threads, applications,
 * and quote sheets so the unified queue is complete without requiring
 * every writer to also persist into `MOCK_INBOUND_SUBMISSIONS`. The
 * production swap can drop these once each writer inserts directly.
 */
function deriveFromRfps(): InboundSubmission[] {
  return MOCK_PROJECTS.filter(
    (p) =>
      p.kind === "contract" &&
      p.isRfp &&
      !p.rfpApprovedAt &&
      p.status !== "cancelled",
  ).map<InboundSubmission>((p) => ({
    id: `in_rfp_${p.id}`,
    kind: "rfp_intake",
    status: "in_triage",
    title: p.title,
    submitter: p.clientId,
    submitterEmail: null,
    submitterCompany: p.clientId,
    pillarTags: [p.industry],
    keywordTags: p.skillsRequired ?? [],
    body: p.description ?? "",
    attachments: [],
    assignedAdminId: p.adminUserIds[0] ?? null,
    triageNote: p.rfpAdminNote,
    deepLinkHref: `/admin/rfps`,
    derived: true,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

function deriveFromChat(): InboundSubmission[] {
  return listChatThreads().map<InboundSubmission>((t) => ({
    id: `in_chat_${t.id}`,
    kind: "chat_inquiry",
    status:
      t.status === "closed"
        ? "closed_no_action"
        : t.assignedAdminId
          ? "in_triage"
          : "new",
    title: `Chat with ${t.visitorName}`,
    submitter: t.visitorName,
    submitterEmail: t.visitorEmail,
    submitterCompany: null,
    pillarTags: [],
    keywordTags: [],
    body: t.adminNote ?? "(live chat thread — open to read transcript)",
    attachments: [],
    assignedAdminId: t.assignedAdminId,
    triageNote: t.adminNote,
    deepLinkHref: `/admin/chat`,
    derived: true,
    createdAt: t.createdAt,
    updatedAt: t.lastMessageAt,
  }));
}

function deriveFromApplications(): InboundSubmission[] {
  return MOCK_APPLICATIONS
    .filter((a) => a.status === "pending")
    .map<InboundSubmission>((a) => {
      const u = MOCK_USERS.find((x) => x.id === a.userId);
      const name = u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : a.userId;
      return {
        id: `in_app_${a.id}`,
        kind: "join_talent_signup",
        status: "in_triage",
        title: `Tier upgrade — ${name || a.userId} → ${a.requestedTier}`,
        submitter: name || a.userId,
        submitterEmail: u?.email ?? null,
        submitterCompany: null,
        pillarTags: u?.primaryIndustry ? [u.primaryIndustry] : [],
        keywordTags: u?.skills ?? [],
        body: JSON.stringify(a.applicationData ?? {}, null, 2),
        attachments: [],
        assignedAdminId: a.reviewedBy,
        triageNote: null,
        deepLinkHref: `/admin/applications`,
        derived: true,
        createdAt: a.createdAt,
        updatedAt: a.reviewedAt ?? a.createdAt,
      };
    });
}

function deriveFromQuotes(): InboundSubmission[] {
  return MOCK_QUOTES
    .filter((q) => !q.approvedAt && !q.rejectedAt)
    .map<InboundSubmission>((q) => {
      const project = MOCK_PROJECTS.find((p) => p.id === q.projectId);
      const member = MOCK_USERS.find((u) => u.id === q.userId);
      return {
        id: `in_q_${q.id}`,
        kind: "custom_quote_request",
        status: "in_triage",
        title: project ? `Quote — ${project.title}` : `Quote sheet ${q.id}`,
        submitter: member
          ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
          : q.userId,
        submitterEmail: member?.email ?? null,
        submitterCompany: project?.clientId ?? null,
        pillarTags: project ? [project.industry] : [],
        keywordTags: project?.skillsRequired ?? [],
        body: q.memberNote ?? `${q.price} · ${q.timeline}`,
        attachments: [],
        assignedAdminId: null,
        triageNote: null,
        deepLinkHref: `/admin/quotes`,
        derived: true,
        createdAt: q.createdAt,
        updatedAt: q.createdAt,
      };
    });
}

/** Combined view: persisted rows + derived rows, newest-first. */
export function listInboundSubmissions(opts?: {
  kind?: InboundSubmissionKind;
  status?: InboundSubmissionStatus;
  assignedAdminId?: string;
}): InboundSubmission[] {
  const all = [
    ...MOCK_INBOUND_SUBMISSIONS,
    ...deriveFromRfps(),
    ...deriveFromChat(),
    ...deriveFromApplications(),
    ...deriveFromQuotes(),
  ];
  return all
    .filter((s) => !opts?.kind || s.kind === opts.kind)
    .filter((s) => !opts?.status || s.status === opts.status)
    .filter(
      (s) =>
        !opts?.assignedAdminId || s.assignedAdminId === opts.assignedAdminId,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function findInboundSubmission(id: string): InboundSubmission | null {
  return MOCK_INBOUND_SUBMISSIONS.find((s) => s.id === id) ?? null;
}
