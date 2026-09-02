/**
 * The inbound queue: stored submissions plus derived ones.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Earlier today the three paths that CREATE an inbound submission were
 * moved from an in-memory array to Postgres: the public signup form,
 * CSV lead import, and EPK booking requests. The admin queue was not
 * moved with them, so it kept reading MOCK_INBOUND_SUBMISSIONS.
 *
 * That split is worse than the original bug. Before, enquiries were
 * lost on restart but at least visible until then. After the writer
 * moved, a real signup landed in the table and the queue rendered seed
 * rows instead, so a genuine enquiry was invisible from the moment it
 * arrived.
 *
 * Writer and reader have to move together. This is the reader.
 *
 * The derived rows stay. RFPs, chat threads, applications and quote
 * sheets are surfaced in the same queue without each of those writers
 * also persisting a duplicate submission row, which is deliberate:
 * they already have their own tables and their own lifecycle.
 * ─────────────────────────────────────────────────────────────
 */
import { db } from "@/db/client";
import { inboundSubmissions } from "@/db/schema";
import { derivedInboundSubmissions } from "@/lib/mock-data/inbound-submissions";
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
  const stored = (await db
    .select()
    .from(inboundSubmissions)) as unknown as InboundSubmission[];

  const all = [...stored, ...derivedInboundSubmissions()];

  return all
    .filter((s) => !opts?.kind || s.kind === opts.kind)
    .filter((s) => !opts?.status || s.status === opts.status)
    .filter(
      (s) =>
        !opts?.assignedAdminId || s.assignedAdminId === opts.assignedAdminId,
    )
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}
