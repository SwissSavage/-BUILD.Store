/**
 * Two motions share the inbound queue, and they are not the same job.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05)
 *
 * Every one of the ten inbound kinds was triaged through one status
 * dropdown reading New / In triage / Needs info / Converted / Closed.
 * Those words describe a client pipeline. They do not describe what
 * happens to someone asking to join the cooperative, where the answer
 * is yes or no and "Converted" is not a thing a person becomes.
 *
 * So the queue is split by what the submission is asking for:
 *
 *   ADMISSION  someone asking to be let in. Talent applying to join,
 *              an org applying to partner, a seller applying to the
 *              store. The decision is approve or reject.
 *
 *   PIPELINE   someone bringing demand. Hire talent, build a team, an
 *              RFP, a quote request, a chat or booking enquiry. The
 *              work is triage, and it ends converted or closed.
 *
 * Storage does not change. `converted` and `closed_no_action` already
 * meant approved and rejected — inbound-submission-actions.ts says so
 * in a comment and emits rfp.approved / rfp.rejected off exactly that
 * pair. This file gives those two values honest labels per kind and
 * keeps terminal states out of the dropdown on admission rows, so a
 * decision is made by pressing a button that says what it does rather
 * than by picking the fifth option in a select.
 * ─────────────────────────────────────────────────────────────
 */
import {
  INBOUND_SUBMISSION_STATUS_LABELS,
  type InboundSubmissionKind,
  type InboundSubmissionStatus,
} from "@/lib/types";

/** Kinds where the submission is a request to be let in. */
export const ADMISSION_KINDS: InboundSubmissionKind[] = [
  "join_talent_signup",
  "partner_application",
  "store_inquiry",
];

export function isAdmissionKind(kind: InboundSubmissionKind): boolean {
  return ADMISSION_KINDS.includes(kind);
}

/** The two terminal states, named once so nothing re-derives them. */
export const INBOUND_APPROVED: InboundSubmissionStatus = "converted";
export const INBOUND_REJECTED: InboundSubmissionStatus = "closed_no_action";

export function isTerminalInboundStatus(status: InboundSubmissionStatus) {
  return status === INBOUND_APPROVED || status === INBOUND_REJECTED;
}

const ADMISSION_STATUS_LABELS: Record<InboundSubmissionStatus, string> = {
  new: "New",
  in_triage: "Under review",
  needs_info: "Needs info",
  converted: "Approved",
  closed_no_action: "Rejected",
};

/** What this status is called, given what the submission is asking for. */
export function inboundStatusLabel(
  kind: InboundSubmissionKind,
  status: InboundSubmissionStatus,
): string {
  return isAdmissionKind(kind)
    ? ADMISSION_STATUS_LABELS[status]
    : INBOUND_SUBMISSION_STATUS_LABELS[status];
}

/**
 * Statuses offered in the dropdown. Admission rows get the working
 * states only: approving and rejecting are buttons, so that a decision
 * cannot be made by mis-clicking a select and then pressing Update.
 */
export function inboundStatusOptions(
  kind: InboundSubmissionKind,
): InboundSubmissionStatus[] {
  return isAdmissionKind(kind)
    ? ["new", "in_triage", "needs_info"]
    : ["new", "in_triage", "needs_info", "converted", "closed_no_action"];
}

/** Heading over the decision controls, so the panel says what it is. */
export function inboundTriageHeading(kind: InboundSubmissionKind): string {
  return isAdmissionKind(kind) ? "Decision" : "Triage";
}
