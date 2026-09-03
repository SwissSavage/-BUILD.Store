/**
 * The inbound queue: stored submissions plus derived ones.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02, extended 2026-09-03)
 *
 * On 09-02 the three paths that CREATE an inbound submission were
 * moved from an in-memory array to Postgres: the public signup form,
 * CSV lead import, and EPK booking requests. The admin queue was not
 * moved with them, so it kept reading MOCK_INBOUND_SUBMISSIONS. That
 * split was worse than the original bug: a real signup landed in the
 * table and the queue rendered seed rows instead, so a genuine enquiry
 * was invisible from the moment it arrived. Fixing that is what this
 * file was for.
 *
 * On 09-03 the other half showed up. The queue does not only render
 * stored rows; it composes them with rows DERIVED from four other
 * sources, so that RFPs, chat threads, tier applications and quote
 * sheets appear in one place without each of those writers persisting
 * a duplicate submission row. That composition is still the right
 * design. What was wrong is that all four derivations read fixture
 * arrays: MOCK_PROJECTS, the in-memory chat store, MOCK_APPLICATIONS
 * and MOCK_QUOTES.
 *
 * So the admin's main triage surface showed real stored submissions
 * sitting alongside seed RFPs from July, seed tier applications and
 * seed quote sheets, with no way to tell which was which. A real RFP
 * awaiting approval did not appear here at all.
 *
 * All four now derive from the live tables. The derivation moved into
 * this file rather than staying in mock-data, because that is where a
 * reader belongs and because leaving it there is how it ends up
 * reading fixtures again.
 * ─────────────────────────────────────────────────────────────
 */
import { db } from "@/db/client";
import { inboundSubmissions } from "@/db/schema";
import { getAllProjects } from "@/lib/readers/projects";
import { getAllUsers } from "@/lib/readers/users";
import {
  membershipApplicationReader,
  quoteSheetReader,
  safely,
} from "@/lib/readers";
import { listThreads } from "@/lib/writers/chat";
import type {
  InboundSubmission,
  InboundSubmissionKind,
  InboundSubmissionStatus,
} from "@/lib/types";

export async function listInboundSubmissionsLive(opts?: {
  kind?: InboundSubmissionKind;
  status?: InboundSubmissionStatus;
  assignedAdminId?: string;
}): Promise<InboundSubmission[]> {
  const [stored, derived] = await Promise.all([
    db.select().from(inboundSubmissions) as unknown as Promise<
      InboundSubmission[]
    >,
    derivedInboundSubmissions(),
  ]);

  const all = [...stored, ...derived];

  return all
    .filter((s) => !opts?.kind || s.kind === opts.kind)
    .filter((s) => !opts?.status || s.status === opts.status)
    .filter(
      (s) =>
        !opts?.assignedAdminId || s.assignedAdminId === opts.assignedAdminId,
    )
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

/**
 * Rows derived from other tables rather than stored as submissions.
 *
 * Every source is wrapped in `safely`. One unreachable table should
 * cost the queue that one category, not the whole page: an admin
 * seeing three of four kinds is workable, an admin seeing an error is
 * not, and an admin seeing nothing cannot tell empty from broken.
 */
export async function derivedInboundSubmissions(): Promise<
  InboundSubmission[]
> {
  const [rfps, chat, applications, quotes] = await Promise.all([
    safely(() => deriveFromRfps(), []),
    safely(() => deriveFromChat(), []),
    safely(() => deriveFromApplications(), []),
    safely(() => deriveFromQuotes(), []),
  ]);
  return [...rfps, ...chat, ...applications, ...quotes];
}

/** RFPs submitted by clients and not yet approved onto the board. */
async function deriveFromRfps(): Promise<InboundSubmission[]> {
  const { projects } = await getAllProjects();
  return projects
    .filter(
      (p) =>
        p.kind === "contract" &&
        p.isRfp &&
        !p.rfpApprovedAt &&
        p.status !== "cancelled",
    )
    .map<InboundSubmission>((p) => ({
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
      linkedResourceId: null,
      derived: true,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
}

/** Live chat threads, so an unanswered visitor shows up in triage. */
async function deriveFromChat(): Promise<InboundSubmission[]> {
  const threads = await listThreads();
  return threads.map<InboundSubmission>((t) => ({
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
    body: t.adminNote ?? "(live chat thread. Open to read the transcript.)",
    attachments: [],
    assignedAdminId: t.assignedAdminId,
    triageNote: t.adminNote,
    deepLinkHref: `/admin/chat`,
    linkedResourceId: null,
    derived: true,
    createdAt: t.createdAt,
    updatedAt: t.lastMessageAt,
  }));
}

/** Tier upgrade requests awaiting a decision. */
async function deriveFromApplications(): Promise<InboundSubmission[]> {
  const [applications, { users }] = await Promise.all([
    membershipApplicationReader.all(),
    getAllUsers(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));

  return applications
    .filter((a) => a.status === "pending")
    .map<InboundSubmission>((a) => {
      const u = byId.get(a.userId);
      const name = u
        ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
        : a.userId;
      return {
        id: `in_app_${a.id}`,
        kind: "join_talent_signup",
        status: "in_triage",
        title: `Tier upgrade: ${name || a.userId} to ${a.requestedTier}`,
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
        linkedResourceId: null,
        derived: true,
        createdAt: a.createdAt,
        updatedAt: a.reviewedAt ?? a.createdAt,
      };
    });
}

/** Quote sheets a member has submitted and an admin has not ruled on. */
async function deriveFromQuotes(): Promise<InboundSubmission[]> {
  const [quotes, { projects }, { users }] = await Promise.all([
    quoteSheetReader.all(),
    getAllProjects(),
    getAllUsers(),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return quotes
    .filter((q) => !q.approvedAt && !q.rejectedAt)
    .map<InboundSubmission>((q) => {
      const project = projectById.get(q.projectId);
      const member = userById.get(q.userId);
      return {
        // `in_quote_`, not `in_q_`. isDerivedSubmission in
        // writers/inbound-submissions-update matches on `in_quote_`,
        // and the old derivation emitted `in_q_`, so a derived quote
        // row was not recognised as derived and a triage action on
        // one would have gone looking for a stored row that does not
        // exist.
        id: `in_quote_${q.id}`,
        kind: "custom_quote_request",
        status: "in_triage",
        title: project ? `Quote: ${project.title}` : `Quote sheet ${q.id}`,
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
        linkedResourceId: null,
        derived: true,
        createdAt: q.createdAt,
        updatedAt: q.createdAt,
      };
    });
}
