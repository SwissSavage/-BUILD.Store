/**
 * Persist an inbound submission.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * `/admin/inbound` reads `inbound_submissions` from Postgres. Every
 * path that CREATES one was still calling `pushInboundSubmission`,
 * which appended to an in-memory array. Reader swapped, writer did not.
 *
 * The three call sites are not marginal:
 *   - the public signup form (someone asking to join or to hire)
 *   - CSV import of existing leads
 *   - EPK booking requests
 *
 * So a stranger filled in the signup form, saw a success page, and the
 * enquiry lived in one container's memory until the next deploy. It
 * never reached the admin queue, and the queue looked empty in the
 * ordinary way an empty queue looks, which is indistinguishable from
 * nobody having written in.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { inboundSubmissions } from "@/db/schema";
import type { InboundSubmission } from "@/lib/types";

export type NewInboundSubmission = Omit<
  InboundSubmission,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * Insert one submission and return the stored row.
 *
 * Throws on failure by design. An enquiry that did not persist must not
 * render a success page: the whole failure being fixed here is a
 * submission that looked accepted and was not. Callers that genuinely
 * cannot fail (a bulk CSV import, where one bad row should not abort
 * the batch) catch it themselves and say which row was dropped.
 */
export async function insertInboundSubmission(
  partial: NewInboundSubmission,
): Promise<InboundSubmission> {
  const now = new Date().toISOString();
  const row: InboundSubmission = {
    ...partial,
    id: `in_${randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(inboundSubmissions).values({
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    submitter: row.submitter,
    submitterEmail: row.submitterEmail ?? null,
    submitterCompany: row.submitterCompany ?? null,
    pillarTags: row.pillarTags ?? [],
    keywordTags: row.keywordTags ?? [],
    body: row.body,
    attachments: row.attachments ?? [],
    // Only set when an admin has actually been assigned. A dangling id
    // would violate the users foreign key and reject the whole row.
    assignedAdminId: row.assignedAdminId ?? null,
    triageNote: row.triageNote ?? null,
    deepLinkHref: row.deepLinkHref ?? null,
    linkedResourceId: row.linkedResourceId ?? null,
    derived: row.derived ?? false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return row;
}
