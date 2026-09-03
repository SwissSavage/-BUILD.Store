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
    linkedResourceId: null,
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
    triageNote: "Pinged Chibu, asking BBG to scope.",
    deepLinkHref: null,
    linkedResourceId: null,
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
    linkedResourceId: null,
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
 * Derived rows moved to lib/readers/inbound-submissions.ts on
 * 2026-09-03. They used to be built here from MOCK_PROJECTS, the
 * in-memory chat store, MOCK_APPLICATIONS and MOCK_QUOTES, so the
 * admin inbound queue showed July seed RFPs, seed tier applications
 * and seed quote sheets next to real stored submissions, and a real
 * RFP awaiting approval did not appear at all. A reader belongs with
 * the readers.
 */

export function findInboundSubmission(id: string): InboundSubmission | null {
  return MOCK_INBOUND_SUBMISSIONS.find((s) => s.id === id) ?? null;
}
