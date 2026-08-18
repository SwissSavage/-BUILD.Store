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
import {
  agreements as agreementsTable,
  invoices as invoicesTable,
  inviteLinks as inviteLinksTable,
} from "@/db/schema";
import {
  verifyWebhookSignature,
  getPayloadTarget,
  getDocument,
  type DocumensoWebhookPayload,
  type DocumensoWebhookEventType,
} from "@/lib/documenso";
import { dispatchInviteEmail } from "@/lib/invite-email";
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
  // Documenso ships event names in three casing conventions across
  // versions: dotted lowercase (envelope.sent / document.sent),
  // SCREAMING_CASE with underscores (DOCUMENT_SENT), and both prefixes.
  // Normalize by uppercasing + stripping punctuation, then match on a
  // single canonical string per FM verb.
  const canon = String(event).toUpperCase().replace(/[.:_-]/g, "");
  switch (canon) {
    case "ENVELOPESENT":
    case "DOCUMENTSENT":
      return "sent";
    case "ENVELOPEOPENED":
    case "ENVELOPEVIEWED":
    case "DOCUMENTOPENED":
    case "DOCUMENTVIEWED":
      return "viewed";
    case "ENVELOPESIGNED":
    case "ENVELOPECOMPLETED":
    case "DOCUMENTSIGNED":
    case "DOCUMENTCOMPLETED":
    case "RECIPIENTCOMPLETED":
      return "completed";
    case "ENVELOPEREJECTED":
    case "DOCUMENTREJECTED":
      return "rejected";
    case "ENVELOPECANCELLED":
    case "DOCUMENTCANCELLED":
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
  // Self-hosted Documenso sends the raw shared secret in
  // X-Documenso-Secret. Older/cloud versions used X-Documenso-Signature
  // (HMAC over body). Check both for cross-version compat; the verifier
  // treats the header value as the shared secret in either case.
  const signature =
    request.headers.get("X-Documenso-Secret") ??
    request.headers.get("X-Documenso-Signature");
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
    // Debug logging to help reconcile Documenso ↔ FM webhook secret
    // when signatures mismatch. Logs the header names Documenso sent,
    // the received signature (truncated), and what we computed with
    // our secret. Compare the two in the deploy log; if they differ,
    // the secrets don't match; if they match but we still reject,
    // there's a format bug (prefix, encoding, etc.).
    const { createHmac } = await import("crypto");
    const computed = createHmac("sha256", DOCUMENSO_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    const headerNames = [...request.headers.keys()]
      .filter((n) => n.toLowerCase().includes("sig") || n.toLowerCase().includes("documenso"))
      .join(",");
    // eslint-disable-next-line no-console
    console.warn(
      `[documenso webhook] rejected request with invalid/missing signature. ` +
        `receivedHeader=${signature ? `${signature.slice(0, 12)}…len=${signature.length}` : "null"} ` +
        `computed=${computed.slice(0, 12)}…len=${computed.length} ` +
        `signatureHeaders=[${headerNames}] ` +
        `secretPreview=${DOCUMENSO_WEBHOOK_SECRET.slice(0, 4)}…len=${DOCUMENSO_WEBHOOK_SECRET.length}`,
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
  // Documenso ids are numeric on v2 documents; we store as string in
  // Postgres for consistency with the rest of the FM domain model.
  const envelopeId = target?.id != null ? String(target.id) : null;

  // TEMP debug: when envelope id lookup misses, log the actual shape
  // Documenso self-hosted is sending so we can add the right accessor.
  // Removes after webhook is green end-to-end.
  if (!envelopeId) {
    // eslint-disable-next-line no-console
    console.log(
      `[documenso webhook] DEBUG payload keys=[${Object.keys(payload).join(",")}] ` +
        `dataKeys=[${payload.data ? Object.keys(payload.data as object).join(",") : "n/a"}] ` +
        `bodyPreview=${rawBody.slice(0, 800)}`,
    );
  }

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

  // 0. Invite countersign path. LOI envelopes generated by the invite
  //    flow carry externalId "invite:<code>". When the admin recipient
  //    completes their signature, we mint + send the branded invitee
  //    email (which contains the invitee-side signing URL). The invitee
  //    recipient's own completion event doesn't need action here — the
  //    ceremony flow drives from /invite/[code]/code onward.
  const externalIdRaw = String(target?.externalId ?? "").trim();
  if (externalIdRaw.startsWith("invite:") && normalized === "completed") {
    const inviteCode = externalIdRaw.slice("invite:".length);
    const [invite] = await db
      .select()
      .from(inviteLinksTable)
      .where(eq(inviteLinksTable.code, inviteCode))
      .limit(1);

    if (!invite) {
      console.warn(
        `[documenso webhook] invite:<code> event but no matching invite row for code=${inviteCode}. Envelope ${envelopeId} may be orphaned.`,
      );
      return NextResponse.json({
        received: true,
        handled: false,
        reason: "invite not found",
      });
    }

    // Self-hosted Documenso payloads don't reliably surface the
    // completing recipient at payload.recipient — it lives in
    // data.recipients as an array with per-recipient signingStatus.
    // Read that array (fall back to top-level recipient for older
    // payload shapes) and decide by INVITEE's status:
    //
    //   - Invitee status is COMPLETED  → invitee just signed (or is
    //     already done). Ceremony flow handles the rest. No email.
    //   - Invitee status is PENDING/WAITING → admin just countersigned
    //     (or event is spurious). If admin has completed and we haven't
    //     sent the invitee email yet, fire it.
    const payloadRecipients = (target?.recipients ?? []) as Array<{
      email?: string;
      signingStatus?: string;
      status?: string;
    }>;
    const inviteeInPayload = payloadRecipients.find(
      (r) => r.email?.toLowerCase() === invite.targetEmail.toLowerCase(),
    );
    const inviteeStatus = String(
      inviteeInPayload?.signingStatus ?? inviteeInPayload?.status ?? "",
    ).toUpperCase();
    const inviteeAlreadyCompleted =
      inviteeStatus === "COMPLETED" || inviteeStatus === "SIGNED";

    // Legacy shape fallback: top-level recipient with email matching invitee.
    const topLevelRecipientEmail =
      payload.recipient?.email?.toLowerCase() ?? "";
    const isInviteeCompletionByTopLevel =
      topLevelRecipientEmail === invite.targetEmail.toLowerCase();

    if (inviteeAlreadyCompleted || isInviteeCompletionByTopLevel) {
      console.log(
        `[documenso webhook] invite:${inviteCode} — invitee completed. No action (ceremony flow drives).`,
      );
      return NextResponse.json({
        received: true,
        handled: true,
        event,
        targetKind: "invite",
        note: "invitee completion — no action needed",
      });
    }

    // Invitee hasn't signed yet. This event must be the admin
    // countersign (or an intermediate event we don't care about).
    // Idempotent guard: if we already dispatched the invitee email,
    // skip so retries don't double-send.
    if (invite.inviteeEmailSentAt) {
      console.log(
        `[documenso webhook] invite:${inviteCode} — invitee email already dispatched at ${invite.inviteeEmailSentAt}. Skipping duplicate.`,
      );
      return NextResponse.json({
        received: true,
        handled: true,
        event,
        targetKind: "invite",
        note: "invitee email already sent",
      });
    }

    // Fetch the full doc to grab the invitee's signing URL, then fire
    // the branded FM invite email pointing at our own invite page
    // (invitee clicks through and lands on /sign which resolves back
    // to this same envelope via the stored documensoDocumentId).
    const docIdForFetch = invite.documensoDocumentId ?? envelopeId;
    let doc;
    try {
      doc = await getDocument(docIdForFetch);
    } catch (err) {
      console.error(
        `[documenso webhook] invite:${inviteCode} — getDocument failed for docId=${docIdForFetch}`,
        err,
      );
      return NextResponse.json({
        received: true,
        handled: false,
        reason: "documenso fetch failed",
      });
    }
    const inviteeRecipient = doc.recipients?.find(
      (r) => r.email?.toLowerCase() === invite.targetEmail.toLowerCase(),
    );
    if (!inviteeRecipient?.signingUrl) {
      console.warn(
        `[documenso webhook] invite:${inviteCode} — no invitee signing URL in doc ${docIdForFetch}.`,
      );
      return NextResponse.json({
        received: true,
        handled: false,
        reason: "no invitee signing URL",
      });
    }

    // Build the FM invite page URL for the branded email. The invite
    // page's /sign action resolves the invitee's Documenso URL from
    // the stored document id and redirects them into it — so the
    // invitee sees FM chrome first, then signs an already-countersigned
    // LOI.
    const originBase = (
      process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ""
    ).replace(/\/$/, "");
    const fmInviteUrl = `${originBase}/invite/${invite.code}`;

    try {
      await dispatchInviteEmail({
        targetEmail: invite.targetEmail,
        targetName: invite.targetName,
        targetTier: invite.targetTier,
        inviteUrl: fmInviteUrl,
        senderName: "A Future Modern",
      });
    } catch (err) {
      console.error(
        `[documenso webhook] invite:${inviteCode} — invitee email dispatch failed`,
        err,
      );
      return NextResponse.json({
        received: true,
        handled: false,
        reason: "invitee email dispatch failed",
      });
    }

    await db
      .update(inviteLinksTable)
      .set({
        adminCountersignedAt: now,
        inviteeEmailSentAt: now,
      })
      .where(eq(inviteLinksTable.id, invite.id));

    console.log(
      `[documenso webhook] invite:${inviteCode} — admin countersigned, invitee email dispatched to ${invite.targetEmail}.`,
    );

    return NextResponse.json({
      received: true,
      handled: true,
      event,
      targetKind: "invite",
      inviteId: invite.id,
    });
  }

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

  // externalId is the correlation string we set at send time. Format:
  //   "agreement:<agreementType>:<userId>"   for LOI sends
  //   "agreement:ncnda:<variant>"            for NCNDA sends (no user)
  //   "invoice:<invoice.id>"                 for retroactive receipts
  // We parse the prefix to decide what to do on completion. Retroactive
  // receipts landed via the invoice-row lookup path above, so if we're
  // here we're either an LOI (auto-create Agreement row) or an NCNDA
  // whose Agreement row is created inline against the primary signer.
  const externalId = String(target?.externalId ?? "").trim();
  if (!externalId) {
    // eslint-disable-next-line no-console
    console.warn(
      `[documenso webhook] completed document ${envelopeId} has no externalId. Cannot auto-create the FM-side row. Log manually via /admin/agreements.`,
    );
    return NextResponse.json({
      received: true,
      handled: false,
      reason: "missing externalId on document",
    });
  }
  const parts = externalId.split(":");
  const kind = parts[0]; // "agreement" or "invoice"
  if (kind !== "agreement") {
    // "invoice:<id>" completions should have already been handled by the
    // invoice-lookup path above (updates row.signatureStatus). If we're
    // here, the invoice row was deleted between send and completion.
    // eslint-disable-next-line no-console
    console.warn(
      `[documenso webhook] completed document ${envelopeId} with externalId=${externalId} but no matching FM row was found. Log manually if needed.`,
    );
    return NextResponse.json({
      received: true,
      handled: false,
      reason: `no matching FM row for externalId ${externalId}`,
    });
  }
  const agreementType = parts[1] as AgreementType | "ncnda";
  // For LOI: parts = ["agreement", "loi", "<userId>"]
  // For NCNDA: parts = ["agreement", "ncnda", "<variant>"]
  // NCNDA counterparties are typically prospects, not FM users, so we
  // don't have a userId on hand. Store the primary recipient email as
  // the identifying string in externalRef and leave userId null-ish.
  const isNcnda = agreementType === "ncnda";
  const persistedAgreementType: AgreementType = isNcnda ? "other" : agreementType;
  const userIdOrLabel = isNcnda
    ? `ncnda:${target?.recipients?.[0]?.email ?? "unknown"}`
    : parts[2] ?? "unknown";

  const agreementRow: Agreement = {
    id: `agreement_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    userId: userIdOrLabel,
    agreementType: persistedAgreementType,
    // Version defaults to the document's creation date so re-issuing
    // the template with a revised version bump doesn't collide.
    version: (target?.createdAt ?? now).slice(0, 10),
    signedAt: now,
    provider: "documenso",
    externalRef: envelopeId,
    storageUrl: null,
    notes: isNcnda
      ? `Auto-created NCNDA (variant ${parts[2] ?? "bilateral"}) from Documenso ${event} at ${now}. Recipient: ${target?.recipients?.[0]?.email ?? "unknown"}.`
      : `Auto-created from Documenso ${event} at ${now}.`,
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
      externalId,
      agreementType: persistedAgreementType,
      userIdOrLabel,
    },
    reason: `Documenso ${event}. Auto-created ${persistedAgreementType} agreement from externalId=${externalId}, document=${envelopeId}.`,
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
