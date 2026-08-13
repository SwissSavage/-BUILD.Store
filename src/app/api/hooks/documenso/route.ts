/**
 * Inbound webhook: Documenso envelope lifecycle events.
 *
 * Subscribe this URL in the Documenso admin at sign.afuturemodern.com
 * (Settings → Webhooks) to the envelope events FM cares about:
 * envelope.sent, envelope.opened, envelope.viewed, envelope.signed,
 * envelope.completed, envelope.rejected, envelope.cancelled,
 * recipient.completed.
 *
 * Signature verification: Documenso signs each request with an
 * HMAC-SHA256 of the raw body using the configured webhook secret,
 * delivered in the X-Documenso-Signature header. Fails closed if
 * DOCUMENSO_WEBHOOK_SECRET isn't configured, or if the signature
 * doesn't check out — better to reject unsigned traffic than to
 * trust whoever finds the URL.
 *
 * State machine:
 *   - Route by envelope id. First try `invoices.documenso_envelope_id`;
 *     if that hits, advance the invoice's signature_status per event.
 *   - Otherwise try `agreements.documenso_envelope_id`; if that hits,
 *     advance the agreement.
 *   - Otherwise treat this as a first-time completion of a still-
 *     unrecorded agreement (LOI path — the send action doesn't create
 *     a row until we know it landed). On envelope.completed / signed,
 *     read metadata.userId + metadata.agreementType from the envelope
 *     and INSERT the Agreement row with provider="documenso".
 *
 * Event → signatureStatus mapping (across both document.* and
 * envelope.* naming):
 *   sent            → sent
 *   opened/viewed   → viewed
 *   signed/completed→ completed (+ signatureCompletedAt = now)
 *   rejected        → rejected
 *   cancelled       → voided
 *
 * All handled events emit an audit log entry with the right verb.
 * Unhandled event types acknowledge + log to console so Documenso
 * doesn't retry-storm the endpoint.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agreements as agreementsTable, invoices as invoicesTable } from "@/db/schema";
import {
  verifyWebhookSignature,
  getPayloadTarget,
  type DocumensoWebhookPayload,
  type DocumensoWebhookEventType,
} from "@/lib/documenso";
import {
  logAuditEvent,
} from "@/lib/mock-data/audit-log";
import type {
  Agreement,
  AgreementType,
  AuditLogAction,
  SignatureStatus,
} from "@/lib/types";

const DOCUMENSO_WEBHOOK_SECRET = process.env.DOCUMENSO_WEBHOOK_SECRET;

// ────────────────────────────────────────────────────────────────
//  Event normalization
// ────────────────────────────────────────────────────────────────

type NormalizedEvent =
  | "sent"
  | "viewed"
  | "completed"
  | "rejected"
  | "voided";

/**
 * Collapse the split document.* / envelope.* naming into one internal
 * event vocabulary. Returns null for events we don't route (e.g.
 * envelope.created — the send action already writes signature_status=
 * "sent" preemptively so we don't need to observe the create).
 */
function normalizeEvent(event: DocumensoWebhookEventType): NormalizedEvent | null {
  switch (event) {
    case "envelope.sent":
    case "document.sent":
      return "sent";
    case "envelope.opened":
    case "envelope.viewed":
    case "document.opened":
    case "document.viewed":
      return "viewed";
    case "envelope.signed":
    case "envelope.completed":
    case "document.signed":
    case "document.completed":
    case "recipient.completed":
      return "completed";
    case "envelope.rejected":
    case "document.rejected":
      return "rejected";
    case "envelope.cancelled":
    case "document.cancelled":
      return "voided";
    default:
      return null;
  }
}

/** Map normalized event to the persisted signatureStatus column value. */
function statusForEvent(ev: NormalizedEvent): SignatureStatus {
  switch (ev) {
    case "sent": return "sent";
    case "viewed": return "viewed";
    case "completed": return "completed";
    case "rejected": return "rejected";
    case "voided": return "voided";
  }
}

/** Map normalized event to the audit-log verb. */
function auditVerbForEvent(ev: NormalizedEvent): AuditLogAction {
  switch (ev) {
    case "sent": return "document.signature_requested";
    case "viewed": return "document.signature_viewed";
    case "completed": return "document.signature_completed";
    case "rejected": return "document.signature_rejected";
    case "voided": return "document.signature_voided";
  }
}

// ────────────────────────────────────────────────────────────────
//  Route
// ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const signature = request.headers.get("X-Documenso-Signature");
  const rawBody = await request.text();

  if (!DOCUMENSO_WEBHOOK_SECRET) {
    // eslint-disable-next-line no-console
    console.error(
      "[documenso webhook] DOCUMENSO_WEBHOOK_SECRET not set — rejecting unsigned request. " +
        "Set the secret in .env.local locally + Dokploy env in prod, and configure the same value on the Documenso side under Webhook settings.",
    );
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    // eslint-disable-next-line no-console
    console.warn(
      "[documenso webhook] rejected request with invalid/missing signature",
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: DocumensoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DocumensoWebhookPayload;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[documenso webhook] failed to parse JSON body", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, recipient } = payload;
  const target = getPayloadTarget(payload);
  const envelopeId = target?.id ?? null;

  // Always log for the audit trail — even events we don't route.
  // eslint-disable-next-line no-console
  console.log(
    `[documenso webhook] ${event} targetId=${envelopeId ?? "n/a"} recipient=${recipient?.email ?? "n/a"}`,
  );

  const normalized = normalizeEvent(event);
  if (!normalized) {
    return NextResponse.json({ received: true, handled: false, event });
  }

  if (!envelopeId) {
    // Nothing to route to without an envelope id — acknowledge so
    // Documenso doesn't retry, but flag it.
    // eslint-disable-next-line no-console
    console.warn(
      `[documenso webhook] ${event} arrived without an envelope id — cannot route to a DB row.`,
    );
    return NextResponse.json({ received: true, handled: false, reason: "no envelope id" });
  }

  const now = new Date().toISOString();
  const newStatus = statusForEvent(normalized);

  // 1. Look up an invoice row keyed to this envelope.
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.documensoEnvelopeId, envelopeId))
    .limit(1);
  if (invoice) {
    await db
      .update(invoicesTable)
      .set({
        signatureStatus: newStatus,
        signatureCompletedAt:
          normalized === "completed" ? now : invoice.signatureCompletedAt,
        updatedAt: now,
      })
      .where(eq(invoicesTable.id, invoice.id));

    logAuditEvent({
      actorUserId: null,
      actorRoleSnapshot: "system",
      action: auditVerbForEvent(normalized),
      resourceKind: "invoice",
      resourceId: invoice.id,
      before: {
        signatureStatus: invoice.signatureStatus,
        signatureCompletedAt: invoice.signatureCompletedAt,
      },
      after: {
        signatureStatus: newStatus,
        signatureCompletedAt:
          normalized === "completed" ? now : invoice.signatureCompletedAt,
      },
      reason: `Documenso ${event} — envelope ${envelopeId} on invoice ${invoice.number}.`,
    });

    return NextResponse.json({
      received: true,
      handled: true,
      event,
      targetKind: "invoice",
      targetId: invoice.id,
      status: newStatus,
    });
  }

  // 2. Look up an agreement row keyed to this envelope.
  const [existingAgreement] = await db
    .select()
    .from(agreementsTable)
    .where(eq(agreementsTable.documensoEnvelopeId, envelopeId))
    .limit(1);
  if (existingAgreement) {
    await db
      .update(agreementsTable)
      .set({
        signatureStatus: newStatus,
        signatureCompletedAt:
          normalized === "completed" ? now : existingAgreement.signatureCompletedAt,
        updatedAt: now,
      })
      .where(eq(agreementsTable.id, existingAgreement.id));

    logAuditEvent({
      actorUserId: null,
      actorRoleSnapshot: "system",
      action: auditVerbForEvent(normalized),
      resourceKind: "agreement",
      resourceId: existingAgreement.id,
      before: {
        signatureStatus: existingAgreement.signatureStatus,
        signatureCompletedAt: existingAgreement.signatureCompletedAt,
      },
      after: {
        signatureStatus: newStatus,
        signatureCompletedAt:
          normalized === "completed" ? now : existingAgreement.signatureCompletedAt,
      },
      reason: `Documenso ${event} — envelope ${envelopeId} on agreement ${existingAgreement.id}.`,
    });

    return NextResponse.json({
      received: true,
      handled: true,
      event,
      targetKind: "agreement",
      targetId: existingAgreement.id,
      status: newStatus,
    });
  }

  // 3. No pre-existing row → this is a first-touch on an envelope we
  //    haven't materialized yet. LOI path: sendLoiForSignature() does
  //    NOT create the Agreement row at send time; the row is inserted
  //    here on the first `completed` event. Requires metadata on the
  //    envelope (userId + agreementType) that was set at send time.
  if (normalized !== "completed") {
    // Non-terminal events for envelopes we don't track yet (e.g.
    // envelope.viewed on an LOI before it completes) are acknowledged
    // and logged, but there's nothing to update. The row will materialize
    // on completion; interim state changes are visible in the Documenso
    // dashboard.
    // eslint-disable-next-line no-console
    console.log(
      `[documenso webhook] ${event} on unknown envelope ${envelopeId} — no row to update yet.`,
    );
    return NextResponse.json({
      received: true,
      handled: true,
      event,
      targetKind: null,
      note: "envelope not tracked in FM DB yet — awaiting completion",
    });
  }

  const metadata = target?.metadata ?? {};
  const metaUserId = String(metadata.userId ?? "").trim();
  const metaAgreementType = String(metadata.agreementType ?? "").trim() as AgreementType;
  if (!metaUserId || !metaAgreementType) {
    // eslint-disable-next-line no-console
    console.warn(
      `[documenso webhook] completed envelope ${envelopeId} has no userId/agreementType metadata — cannot auto-create Agreement row.`,
    );
    return NextResponse.json({
      received: true,
      handled: false,
      reason: "missing envelope metadata",
    });
  }

  const agreementRow: Agreement = {
    id: `agreement_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    userId: metaUserId,
    agreementType: metaAgreementType,
    // Version defaults to the envelope's creation date so re-issuing
    // the template with a revised version bump doesn't collide.
    version: (target?.createdAt ?? now).slice(0, 10),
    signedAt: now,
    provider: "documenso",
    externalRef: envelopeId,
    storageUrl: null,
    notes: `Auto-created from Documenso ${event} at ${now}.`,
    documensoEnvelopeId: envelopeId,
    signatureStatus: "completed",
    signatureCompletedAt: now,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(agreementsTable).values(agreementRow);

  logAuditEvent({
    actorUserId: null,
    actorRoleSnapshot: "system",
    action: "document.signature_completed",
    resourceKind: "agreement",
    resourceId: agreementRow.id,
    before: null,
    after: {
      signatureStatus: "completed",
      signatureCompletedAt: now,
      documensoEnvelopeId: envelopeId,
      userId: metaUserId,
      agreementType: metaAgreementType,
    },
    reason: `Documenso ${event} — auto-created ${metaAgreementType} agreement for user ${metaUserId} from envelope ${envelopeId}.`,
  });

  return NextResponse.json({
    received: true,
    handled: true,
    event,
    targetKind: "agreement",
    targetId: agreementRow.id,
    status: "completed",
    created: true,
  });
}
