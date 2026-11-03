/**
 * Attach the real invoice to this app's record of it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03)
 *
 * Jamar: "the invoice Draft is not a real invoice correct... This site
 * doesn't generate the invoice, just a record of it. The real invoices
 * currently, are coming from my Found account."
 *
 * So the record had no way to point at the document it is a record of.
 * invoices.number is minted here and the client has never seen it;
 * they paid against a Found number this system did not store. That gap
 * is the whole reason this file exists: the settlement, the splits and
 * the payout statements all descend from an invoice, and the chain
 * should terminate at the document the client actually received rather
 * than at a number we made up.
 *
 * WHY IT IS EDITABLE AFTER SETTLEMENT
 *
 * Attaching the source document changes nothing about the money. It
 * adds provenance to a record that already exists, and the common case
 * is attaching it late, because the real invoice was sent from Found
 * long before anyone thought to file it here. Refusing the attachment
 * on a settled contract would mean the oldest and most important
 * records are the ones that can never be completed.
 *
 * Every write is audit-logged with before and after, so a number
 * changing later is visible rather than silent.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invoices } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { validateLandingFiles } from "@/lib/landing-inbound-validation";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export interface SourceDocumentResult {
  ok: boolean;
  message: string;
}

export async function attachInvoiceSourceDocument(
  formData: FormData,
): Promise<SourceDocumentResult> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) {
    return { ok: false, message: "Admin only." };
  }

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const sourceNumber = String(formData.get("sourceDocumentNumber") ?? "").trim();
  const file = formData.get("sourceDocument");

  if (!invoiceId) {
    return { ok: false, message: "Missing invoice reference." };
  }

  const [existing] = await db
    .select({
      id: invoices.id,
      contractId: invoices.contractId,
      number: invoices.number,
      sourceDocumentNumber: invoices.sourceDocumentNumber,
      sourceDocumentName: invoices.sourceDocumentName,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!existing) {
    return { ok: false, message: "That invoice does not exist." };
  }

  // Same validator the application forms use, rather than a second
  // opinion about what a safe upload is: PDF only, checked against the
  // %PDF- magic bytes instead of the MIME type the browser claimed.
  let document: { name: string; size: number; base64: string } | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      const [validated] = await validateLandingFiles([file]);
      document = validated
        ? {
            name: validated.name,
            size: validated.size,
            base64: validated.base64,
          }
        : null;
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error && /PDF/i.test(err.message)
            ? "The invoice has to be a PDF."
            : "That file is too large. Keep it under 12MB.",
      };
    }
  }

  if (!sourceNumber && !document) {
    return {
      ok: false,
      message: "Give the real invoice number, the PDF, or both.",
    };
  }

  // A blank field leaves the stored value alone rather than wiping it.
  // Clearing is a separate, deliberate act, not a side effect of
  // submitting the form to change the other field.
  await db
    .update(invoices)
    .set({
      ...(sourceNumber ? { sourceDocumentNumber: sourceNumber } : {}),
      ...(document
        ? {
            sourceDocumentName: document.name,
            sourceDocumentSize: document.size,
            sourceDocumentBase64: document.base64,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invoices.id, invoiceId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "invoice.source_document_attached",
    resourceKind: "invoice",
    resourceId: invoiceId,
    before: {
      sourceDocumentNumber: existing.sourceDocumentNumber,
      sourceDocumentName: existing.sourceDocumentName,
    },
    after: {
      sourceDocumentNumber: sourceNumber || existing.sourceDocumentNumber,
      sourceDocumentName: document?.name ?? existing.sourceDocumentName,
    },
    reason: `Real invoice tied to record ${existing.number}`,
  });

  if (existing.contractId) {
    revalidatePath(`/admin/contracts/${existing.contractId}/ledger`);
  }
  revalidatePath("/admin/invoices");

  return {
    ok: true,
    message: document
      ? "Attached. The record now points at the invoice the client received."
      : "Saved the real invoice number.",
  };
}
