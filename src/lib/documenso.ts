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

/**
 * Union payload type used by the webhook path. Documenso passes back
 * a document-shaped object on document.* events and an envelope-shaped
 * object on envelope.* events, but both carry the fields FM cares about
 * (id, status, externalId, recipients). Keeping one type keeps the
 * webhook branching simple.
 */
export interface DocumensoEnvelope {
  id: string | number;
  type?: "DOCUMENT" | "TEMPLATE";
  status?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  /**
   * FM-side correlation string set at send time via the /api/v2/template/use
   * endpoint. Format: "agreement:<type>:<userId>" or "invoice:<id>" or
   * "agreement:ncnda:<variant>". See webhook route for the parse.
   */
  externalId?: string | null;
  recipients?: Array<{
    id: string | number;
    email: string;
    name?: string;
    status?: string;
    signingUrl?: string;
  }>;
}

/**
 * Documenso v2 template shape (subset). A template has an id (numeric)
 * and a list of placeholder recipients each with their own numeric id.
 * When we call POST /api/v2/template/use we pass those placeholder ids
 * back so Documenso knows which slot our real recipient fills.
 */
export interface DocumensoTemplate {
  id: number;
  title?: string;
  recipients?: Array<{
    id: number;
    email: string;
    name?: string;
    role?: string;
  }>;
}

/**
 * Documenso v2 document shape (subset). Returned by POST /api/v2/template/use.
 * The document's id becomes our internal `documensoEnvelopeId` handle —
 * naming lag from the earlier envelope-API assumption, not a real mismatch.
 */
export interface DocumensoDocument {
  id: number;
  title?: string;
  status?: string;
  externalId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  recipients?: Array<{
    id: number;
    email: string;
    name?: string;
    status?: string;
    signingUrl?: string;
  }>;
}

/**
 * Coerce a template ID env var (string like "5" or a numeric) into the
 * number the Documenso v2 API requires.
 */
function toTemplateIdNumber(raw: string | number): number {
  if (typeof raw === "number") return raw;
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) {
    throw new DocumensoError(
      `Template id "${raw}" is not a valid number. Documenso v2 expects numeric template ids. Check the DOCUMENSO_TEMPLATE_* env var value.`,
      400,
      null,
    );
  }
  return n;
}

/**
 * Fetch a template's shape so we can map real recipients onto its
 * placeholder recipient slots. Required before POST /template/use because
 * that endpoint expects `recipients: [{ id, email, name }]` where `id`
 * is the placeholder recipient id from the template, not an arbitrary id.
 */
export async function getTemplate(
  templateId: string | number,
): Promise<DocumensoTemplate> {
  const id = toTemplateIdNumber(templateId);
  return documensoFetch<DocumensoTemplate>(
    `/api/v2/template/${id}`,
    { method: "GET" },
  );
}

/**
 * Low-level: use a template to spawn a new document, optionally
 * distributing it in the same call. Wraps POST /api/v2/template/use.
 *
 * Callers should generally use inviteRecipientToTemplate /
 * inviteRecipientsToTemplate which handle the template lookup +
 * placeholder mapping automatically.
 */
export async function useTemplate(input: {
  templateId: string | number;
  recipients: Array<{ id: number; email: string; name: string }>;
  distributeDocument?: boolean;
  /** Compact FM-side correlation string (see webhook route for the parse). */
  externalId?: string;
}): Promise<DocumensoDocument> {
  if (input.recipients.length === 0) {
    throw new DocumensoError(
      "useTemplate requires at least one recipient.",
      400,
      null,
    );
  }
  return documensoFetch<DocumensoDocument>("/api/v2/template/use", {
    method: "POST",
    body: JSON.stringify({
      templateId: toTemplateIdNumber(input.templateId),
      recipients: input.recipients,
      distributeDocument: input.distributeDocument ?? true,
      externalId: input.externalId,
    }),
  });
}

/**
 * Fetch the current state of a document. Used by the webhook path
 * as a fallback when the payload doesn't carry the fields we need.
 */
export async function getDocument(
  documentId: string | number,
): Promise<DocumensoDocument> {
  return documensoFetch<DocumensoDocument>(
    `/api/v2/document/${documentId}`,
    { method: "GET" },
  );
}

/**
 * Convenience: fetch the template, map our single recipient onto the
 * first placeholder slot, use-template with distribute=true. One admin
 * click → one email dispatched to the signer.
 *
 * `templateEnvelopeId` is the legacy parameter name kept for caller
 * compatibility; the value should be the numeric template id (either
 * as a number or a numeric string).
 */
export async function inviteRecipientToTemplate(input: {
  templateEnvelopeId: string;
  recipient: DocumensoRecipient;
  title?: string;
  externalId?: string;
  /**
   * Legacy metadata field. Ignored by /api/v2/template/use — pass the
   * correlation info through `externalId` instead. Kept in the signature
   * so existing callers compile; drop when call sites migrate.
   */
  metadata?: Record<string, string>;
}): Promise<DocumensoDocument> {
  if (!input.templateEnvelopeId) {
    throw new DocumensoError(
      "inviteRecipientToTemplate called with empty templateEnvelopeId. " +
        "Populate the corresponding DOCUMENSO_TEMPLATE_* env var with the numeric template id from Documenso.",
      400,
      null,
    );
  }
  const template = await getTemplate(input.templateEnvelopeId);
  const placeholder = template.recipients?.[0];
  if (!placeholder) {
    throw new DocumensoError(
      `Template ${input.templateEnvelopeId} has no placeholder recipient. Open the template in Documenso and add at least one recipient with signature/date/name fields.`,
      400,
      null,
    );
  }
  return useTemplate({
    templateId: input.templateEnvelopeId,
    recipients: [
      {
        id: placeholder.id,
        email: input.recipient.email,
        name: input.recipient.name,
      },
    ],
    distributeDocument: true,
    externalId: input.externalId,
  });
}

/**
 * Multi-recipient variant. Fetches the template, verifies it has at
 * least as many placeholder recipients as we want to fill, maps ours
 * onto its slots in order, use-template with distribute=true.
 */
export async function inviteRecipientsToTemplate(input: {
  templateEnvelopeId: string;
  recipients: DocumensoRecipient[];
  title?: string;
  externalId?: string;
  metadata?: Record<string, string>;
}): Promise<DocumensoDocument> {
  if (!input.templateEnvelopeId) {
    throw new DocumensoError(
      "inviteRecipientsToTemplate called with empty templateEnvelopeId. " +
        "Populate the corresponding DOCUMENSO_TEMPLATE_* env var with the numeric template id from Documenso.",
      400,
      null,
    );
  }
  if (input.recipients.length === 0) {
    throw new DocumensoError(
      "inviteRecipientsToTemplate requires at least one recipient.",
      400,
      null,
    );
  }
  const template = await getTemplate(input.templateEnvelopeId);
  const placeholders = template.recipients ?? [];
  if (placeholders.length < input.recipients.length) {
    throw new DocumensoError(
      `Template ${input.templateEnvelopeId} has ${placeholders.length} placeholder recipient(s) but ${input.recipients.length} were requested. Add more placeholder recipients in Documenso before sending to multiple counterparties.`,
      400,
      null,
    );
  }
  return useTemplate({
    templateId: input.templateEnvelopeId,
    recipients: input.recipients.map((r, i) => ({
      id: placeholders[i].id,
      email: r.email,
      name: r.name,
    })),
    distributeDocument: true,
    externalId: input.externalId,
  });
}

// ────────────────────────────────────────────────────────────────
//  Legacy compatibility shims
// ────────────────────────────────────────────────────────────────

/**
 * @deprecated Kept for backwards compatibility with earlier envelope-API
 * assumptions. Delegates to the correct template-API path. Callers should
 * migrate to useTemplate / inviteRecipientToTemplate directly.
 */
export async function createEnvelopeFromTemplate(input: {
  templateEnvelopeId: string;
  recipient: DocumensoRecipient;
  title?: string;
  metadata?: Record<string, string>;
}): Promise<DocumensoDocument> {
  return inviteRecipientToTemplate({
    ...input,
    externalId: input.metadata?.externalId,
  });
}

/**
 * @deprecated The template-use endpoint distributes in one call when
 * `distributeDocument: true`, so a separate distribute call is no longer
 * needed. Left as a no-op shim so any lingering caller compiles.
 */
export async function distributeEnvelope(
  envelopeId: string,
): Promise<{ id: string }> {
  return { id: envelopeId };
}

/**
 * @deprecated Replaced by getDocument. Kept as a thin shim so the
 * webhook code that reads target envelope state compiles during the
 * migration.
 */
export async function getEnvelope(
  envelopeId: string,
): Promise<DocumensoDocument> {
  return getDocument(envelopeId);
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
