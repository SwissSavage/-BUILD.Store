/**
 * Inbound webhook: HubSpot deal.propertyChange (dealstage).
 *
 * Subscribe this URL in HubSpot's app/webhook settings to the
 * `deal.propertyChange` event, filtered to the `dealstage` property.
 * HubSpot posts an array of event objects, one per changed deal, shape:
 *
 *   [{
 *     "eventId": number,
 *     "subscriptionId": number,
 *     "portalId": number,
 *     "occurredAt": number,        // epoch millis
 *     "subscriptionType": "deal.propertyChange",
 *     "objectId": number,          // the HubSpot deal ID
 *     "propertyName": "dealstage",
 *     "propertyValue": string,     // e.g. "contractsent"
 *     "changeSource": string
 *   }, ...]
 *
 * Signature verification (HubSpot v3 spec): HubSpot signs each request
 * with `X-HubSpot-Signature-v3`, an HMAC-SHA256 (base64) over
 * `${method}${fullUrl}${rawBody}${timestamp}` using the app's client
 * secret, plus `X-HubSpot-Request-Timestamp` for replay protection
 * (reject if older than 5 minutes). Requires `HUBSPOT_APP_CLIENT_SECRET`
 * to be set once a real HubSpot app (not just a Service Key/PAT) exists
 * for this integration — a Service Key alone doesn't sign webhooks.
 *
 * Fails closed: if the secret isn't configured, or the signature doesn't
 * check out, this rejects the request rather than trusting it. Until the
 * app + client secret are provisioned, this endpoint will 503 on every
 * call — that's intentional, better than accepting unsigned stage
 * changes from whoever finds the URL.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  applyHubspotStageWebhook,
  mapHubspotStageToAppStage,
} from "@/lib/crm-stub";

const HUBSPOT_APP_CLIENT_SECRET = process.env.HUBSPOT_APP_CLIENT_SECRET;
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

interface HubspotWebhookEvent {
  objectId: number;
  propertyName: string;
  propertyValue: string;
}

function isValidSignature(
  method: string,
  fullUrl: string,
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  if (!HUBSPOT_APP_CLIENT_SECRET) return false;

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_TIMESTAMP_AGE_MS) {
    return false;
  }

  const expected = createHmac("sha256", HUBSPOT_APP_CLIENT_SECRET)
    .update(`${method}${fullUrl}${rawBody}${timestamp}`)
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(request: Request) {
  const signature = request.headers.get("X-HubSpot-Signature-v3");
  const timestamp = request.headers.get("X-HubSpot-Request-Timestamp");
  const rawBody = await request.text();

  if (!HUBSPOT_APP_CLIENT_SECRET) {
    // eslint-disable-next-line no-console
    console.error(
      "[hubspot webhook] HUBSPOT_APP_CLIENT_SECRET not set — rejecting unsigned request. " +
        "This endpoint fails closed until a real HubSpot app + client secret is provisioned.",
    );
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  if (
    !signature ||
    !timestamp ||
    !isValidSignature(
      "POST",
      request.url,
      rawBody,
      timestamp,
      signature,
    )
  ) {
    // eslint-disable-next-line no-console
    console.warn("[hubspot webhook] rejected request with invalid/missing signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const events = JSON.parse(rawBody) as HubspotWebhookEvent[];

  const results = await Promise.all(
    events
      .filter((event) => event.propertyName === "dealstage")
      .map(async (event) => {
        const mapped = mapHubspotStageToAppStage(event.propertyValue);
        if (!mapped) {
          // eslint-disable-next-line no-console
          console.warn(
            "[hubspot webhook] unmapped deal stage",
            event.propertyValue,
            "for deal",
            event.objectId,
          );
          return { objectId: event.objectId, updated: false };
        }
        const result = await applyHubspotStageWebhook(
          String(event.objectId),
          mapped,
        );
        return { objectId: event.objectId, ...result };
      }),
  );

  return NextResponse.json({ results });
}
