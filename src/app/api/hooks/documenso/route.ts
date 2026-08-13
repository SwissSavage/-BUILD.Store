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
 * the DOCUMENSO_WEBHOOK_SECRET env var isn't configured, or if the
 * signature doesn't check out — better to reject unsigned traffic
 * than to trust whoever finds the URL.
 *
 * On envelope.completed (the load-bearing event for FM's onboarding
 * flow), this route emits an audit log entry and — once the care
 * package flow (task #6) ships — advances the invitee's onboarding
 * state from `signature_sent` to `signed`, unlocking the Creed step.
 *
 * Until the care package flow is wired, this route logs the event
 * and returns success so Documenso doesn't retry-storm the endpoint.
 * The audit log entry captures who signed what and when.
 */
import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  type DocumensoWebhookPayload,
  type DocumensoWebhookEventType,
} from "@/lib/documenso";

const DOCUMENSO_WEBHOOK_SECRET = process.env.DOCUMENSO_WEBHOOK_SECRET;

/**
 * Events that trigger downstream state changes in FM. Everything
 * else is logged for audit but doesn't route to a handler yet.
 */
const HANDLED_EVENTS = new Set<DocumensoWebhookEventType>([
  "envelope.completed",
  "envelope.signed",
  "envelope.rejected",
  "envelope.cancelled",
  "recipient.completed",
]);

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

  const { event, envelope, recipient } = payload;

  // Always log — every event is worth an audit trail entry, even
  // ones we don't route yet.
  // eslint-disable-next-line no-console
  console.log(
    `[documenso webhook] ${event} envelopeId=${envelope?.id} recipient=${recipient?.email ?? "n/a"}`,
  );

  if (!HANDLED_EVENTS.has(event)) {
    // Acknowledged, logged, no downstream action wired for this event.
    return NextResponse.json({ received: true, handled: false });
  }

  // TODO (care package flow — task #6): route the event to the invitee
  // onboarding state machine. On envelope.completed, advance the
  // invitee from `signature_sent` to `signed`. On envelope.rejected
  // or envelope.cancelled, mark the invitation as declined and
  // notify the sending admin. For now the handler acknowledges +
  // logs so Documenso doesn't retry-storm the endpoint.
  //
  // Also TODO: write to audit_log_entries once the audit-log Drizzle
  // swap ships (currently mock).

  return NextResponse.json({
    received: true,
    handled: true,
    event,
    envelopeId: envelope?.id ?? null,
  });
}
