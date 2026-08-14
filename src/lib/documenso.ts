/**
 * Documenso integration — signature capture layer for FM.
 *
 * FM runs a self-hosted Documenso instance at sign.afuturemodern.com
 * (deployed by Bayu on Dokploy). All signature capture across FM
 * routes through this wrapper — Talent Partner Letter of Intent
 * signatures during onboarding, Cooperative Quote acceptance,
 * Client SOW execution, retroactive receipts requiring signed
 * rationale, and any future legal-caliber signature workflow.
 *
 * Built against the Envelopes API (`/api/v2/envelope/*`) per
 * Documenso's migration guidance — Documents/Templates endpoints
 * are deprecated with removal date 1 March 2027. Envelope IDs are
 * strings (e.g., `envelope_abc123`), not numbers.
 *
 * Env vars this module reads:
 *   - DOCUMENSO_BASE_URL       — self-hosted URL, e.g., https://sign.afuturemodern.com
 *   - DOCUMENSO_API_KEY        — API key from Documenso admin, `api_...` format
 *   - DOCUMENSO_WEBHOOK_SECRET — HMAC secret for signature verification on inbound webhooks
 *
 * Consumers import specific functions rather than the raw fetch
 * helper — the wrapper narrows the API surface to what FM actually
 * uses, so upstream changes don't ripple through every caller.
 */

// ────────────────────────────────────────────────────────────────
//  Environment + configuration
// ────────────────────────────────────────────────────────────────

const DOCUMENSO_BASE_URL =
  process.env.DOCUMENSO_BASE_URL ?? "https://sign.afuturemodern.com";
const DOCUMENSO_API_KEY = process.env.DOCUMENSO_API_KEY;

/**
 * Canonical template envelope IDs. Uploaded once via the Documenso
 * admin dashboard, then referenced here. Populate after each template
 * is created on sign.afuturemodern.com; leaving empty strings means
 * the caller will get a clear error rather than silently fail.
 *
 * To upload a new template:
 *   1. Sign in to sign.afuturemodern.com as an admin
 *   2. Upload the PDF, place signature/text fields for signers
 *   3. Save as a Template (type=TEMPLATE envelope)
 *   4. Copy the envelope ID from the URL or API response
 *   5. Paste the ID as the value below
 */
export const DOCUMENSO_TEMPLATES = {
  /** Talent Partner Letter of Intent (Alex Radford version). */
  TALENT_PARTNER_LOI: process.env.DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI ?? "",
  /** Cooperative Quote acceptance (client-facing SOW signature). */
  COOPERATIVE_QUOTE:
    process.env.DOCUMENSO_TEMPLATE_COOPERATIVE_QUOTE ?? "",
  /** Retroactive Receipt requiring signed rationale. */
  RETROACTIVE_RECEIPT:
    process.env.DOCUMENSO_TEMPLATE_RETROACTIVE_RECEIPT ?? "",
  /** Mutual NCNDA — bilateral (FM + 1 counterparty). */
  MUTUAL_NCNDA:
    process.env.DOCUMENSO_TEMPLATE_MUTUAL_NCNDA ?? "",
  /** Mutual NCNDA — multi-party (FM + up to 3 counterparties). */
  MUTUAL_NCNDA_MULTI:
    process.env.DOCUMENSO_TEMPLATE_MUTUAL_NCNDA_MULTI ?? "",
} as const;

// ────────────────────────────────────────────────────────────────
//  Fetch helper
// ────────────────────────────────────────────────────────────────

interface DocumensoErrorPayload {
  message?: string;
  error?: string;
  [key: string]: unknown;
}

class DocumensoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: DocumensoErrorPayload | null,
  ) {
    super(message);
    this.name = "DocumensoError";
  }
}

async function documensoFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!DOCUMENSO_API_KEY) {
    throw new DocumensoError(
      "DOCUMENSO_API_KEY is not set. Configure it in .env.local locally and in Dokploy env vars in prod.",
      500,
      null,
    );
  }

  const url = `${DOCUMENSO_BASE_URL}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", DOCUMENSO_API_KEY);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON response body — surface as raw text in the error.
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      (payload as DocumensoErrorPayload | null)?.message ??
      (payload as DocumensoErrorPayload | null)?.error ??
      `Documenso ${response.status} ${response.statusText}`;
    throw new DocumensoError(
      String(message),
      response.status,
      payload as DocumensoErrorPayload | null,
    );
  }

  return payload as T;
}

// ────────────────────────────────────────────────────────────────
//  Envelope operations
// ────────────────────────────────────────────────────────────────

export interface DocumensoRecipient {
  name: string;
  email: string;
  /** Role on the envelope. SIGNER is the standard signing role. */
  role?: "SIGNER" | "APPROVER" | "VIEWER" | "CC";
}

export interface DocumensoEnvelope {
  id: string;
  type: "DOCUMENT" | "TEMPLATE";
  status: "DRAFT" | "PENDING" | "COMPLETED" | "REJECTED" | "CANCELLED";
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  /**
   * Free-form key-value metadata persisted with the envelope at
   * creation. FM writes `{ userId, agreementType }` for LOI envelopes
   * so the webhook handler can attach the resulting Agreement row to
   * the right user, and `{ invoiceId, ... }` for retroactive receipts
   * so we can look up the invoice by envelope id + double-check.
   * Documenso passes it through verbatim on webhook payloads.
   */
  metadata?: Record<string, string>;
  recipients?: Array<{
    id: string;
    email: string;
    name?: string;
    status?: string;
    signingUrl?: string;
  }>;
}

/**
 * Spawn a signing envelope from an existing template envelope.
 * The template must already exist in the Documenso instance;
 * see DOCUMENSO_TEMPLATES for canonical FM template references.
 *
 * Returns the newly-created DOCUMENT envelope in DRAFT status.
 * Call distributeEnvelope() to send it out for signing.
 */
export async function createEnvelopeFromTemplate(input: {
  templateEnvelopeId: string;
  recipient: DocumensoRecipient;
  /** Optional title override; defaults to the template title. */
  title?: string;
  /** Optional metadata payload persisted with the envelope. */
  metadata?: Record<string, string>;
}): Promise<DocumensoEnvelope> {
  if (!input.templateEnvelopeId) {
    throw new DocumensoError(
      "createEnvelopeFromTemplate called with empty templateEnvelopeId. " +
        "Populate the template ID in src/lib/documenso.ts DOCUMENSO_TEMPLATES or the corresponding env var.",
      400,
      null,
    );
  }
  return documensoFetch<DocumensoEnvelope>("/api/v2/envelope/use", {
    method: "POST",
    body: JSON.stringify({
      envelopeId: input.templateEnvelopeId,
      recipients: [
        {
          email: input.recipient.email,
          name: input.recipient.name,
          role: input.recipient.role ?? "SIGNER",
        },
      ],
      title: input.title,
      metadata: input.metadata,
    }),
  });
}

/**
 * Send an envelope out for signing. After distribution the
 * recipient receives an email from Documenso with the signing link.
 */
export async function distributeEnvelope(
  envelopeId: string,
): Promise<DocumensoEnvelope> {
  return documensoFetch<DocumensoEnvelope>("/api/v2/envelope/distribute", {
    method: "POST",
    body: JSON.stringify({ envelopeId }),
  });
}

/** Get the current state of an envelope + its recipients. */
export async function getEnvelope(
  envelopeId: string,
): Promise<DocumensoEnvelope> {
  return documensoFetch<DocumensoEnvelope>(
    `/api/v2/envelope/${envelopeId}`,
    { method: "GET" },
  );
}

/**
 * Convenience combining create + distribute for the common case
 * where you just want to invite someone to sign a template right now.
 * Returns the distributed envelope.
 */
export async function inviteRecipientToTemplate(input: {
  templateEnvelopeId: string;
  recipient: DocumensoRecipient;
  title?: string;
  metadata?: Record<string, string>;
}): Promise<DocumensoEnvelope> {
  const envelope = await createEnvelopeFromTemplate(input);
  return distributeEnvelope(envelope.id);
}

/**
 * Multi-recipient variant of createEnvelopeFromTemplate. Used for
 * NCNDAs and similar documents that route to N counterparties at once
 * (e.g., the multi-party NCNDA template supports up to 3 Counterparties
 * signing alongside Future Modern).
 */
export async function createEnvelopeFromTemplateMulti(input: {
  templateEnvelopeId: string;
  recipients: DocumensoRecipient[];
  title?: string;
  metadata?: Record<string, string>;
}): Promise<DocumensoEnvelope> {
  if (!input.templateEnvelopeId) {
    throw new DocumensoError(
      "createEnvelopeFromTemplateMulti called with empty templateEnvelopeId. " +
        "Populate the template ID in src/lib/documenso.ts DOCUMENSO_TEMPLATES or the corresponding env var.",
      400,
      null,
    );
  }
  if (input.recipients.length === 0) {
    throw new DocumensoError(
      "createEnvelopeFromTemplateMulti requires at least one recipient.",
      400,
      null,
    );
  }
  return documensoFetch<DocumensoEnvelope>("/api/v2/envelope/use", {
    method: "POST",
    body: JSON.stringify({
      envelopeId: input.templateEnvelopeId,
      recipients: input.recipients.map((r) => ({
        email: r.email,
        name: r.name,
        role: r.role ?? "SIGNER",
      })),
      title: input.title,
      metadata: input.metadata,
    }),
  });
}

/** Multi-recipient equivalent of inviteRecipientToTemplate (create + distribute). */
export async function inviteRecipientsToTemplate(input: {
  templateEnvelopeId: string;
  recipients: DocumensoRecipient[];
  title?: string;
  metadata?: Record<string, string>;
}): Promise<DocumensoEnvelope> {
  const envelope = await createEnvelopeFromTemplateMulti(input);
  return distributeEnvelope(envelope.id);
}

// ────────────────────────────────────────────────────────────────
//  Webhook signature verification
// ────────────────────────────────────────────────────────────────

/**
 * Verify a Documenso webhook signature using the configured
 * DOCUMENSO_WEBHOOK_SECRET. Returns true if the signature is valid.
 *
 * Documenso signs webhook payloads with HMAC-SHA256 over the raw
 * request body, delivered in the `X-Documenso-Signature` header.
 * Fails closed if the secret isn't configured.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = process.env.DOCUMENSO_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const { createHmac, timingSafeEqual } = await import("crypto");

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);

  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

// ────────────────────────────────────────────────────────────────
//  Webhook event types
// ────────────────────────────────────────────────────────────────

/**
 * Documenso emits events under two naming conventions depending on
 * instance version:
 *
 *   - Legacy (Documents API): document.created, document.sent, etc.
 *     Still in use by self-hosted instances that haven't migrated to
 *     the Envelopes API. Documenso plans to remove these on 1 March 2027.
 *
 *   - Current (Envelopes API): envelope.created, envelope.sent, etc.
 *     The replacement, unified system for documents + templates.
 *
 * FM's self-hosted sign.afuturemodern.com is currently emitting the
 * legacy `document.*` names as of 2026-08-13. Handler accepts both
 * so we don't need code changes when Documenso migrates the naming.
 */
export type DocumensoWebhookEventType =
  // Envelopes API (current)
  | "envelope.created"
  | "envelope.sent"
  | "envelope.opened"
  | "envelope.viewed"
  | "envelope.signed"
  | "envelope.completed"
  | "envelope.rejected"
  | "envelope.cancelled"
  | "recipient.completed"
  // Documents API (legacy — self-hosted deployments still emit these)
  | "document.created"
  | "document.sent"
  | "document.opened"
  | "document.viewed"
  | "document.signed"
  | "document.completed"
  | "document.rejected"
  | "document.cancelled";

/**
 * Webhook payload. Documenso's document.* events carry a `document`
 * field; envelope.* events carry an `envelope` field. Both refer to
 * the same underlying construct, so we accept either — consumers
 * read whichever is present.
 */
export interface DocumensoWebhookPayload {
  event: DocumensoWebhookEventType;
  envelope?: DocumensoEnvelope;
  document?: DocumensoEnvelope;
  recipient?: {
    id: string;
    email: string;
    name?: string;
    status?: string;
  };
  occurredAt: string;
  [key: string]: unknown;
}

/**
 * Normalize a webhook payload: returns the envelope/document object
 * regardless of which field name Documenso used, so consumers can
 * write `getPayloadTarget(payload).id` without branching per naming.
 */
export function getPayloadTarget(
  payload: DocumensoWebhookPayload,
): DocumensoEnvelope | undefined {
  return payload.envelope ?? payload.document;
}

// Re-export DocumensoError for typed catch handling upstream.
export { DocumensoError };
