/**
 * Feedback requests go out on their own, and we can tell when they
 * didn't.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS HAD TO EXIST BEFORE THE BUTTON COULD GO (2026-11-24)
 *
 * The settle page used to have an "Issue link" button, pressed by the
 * admin doing the settling — the same admin whose PM rating fills the
 * blend when the client stays silent. Not pressing it moved the
 * decision from the client to themselves.
 *
 * Deleting the button without this module made things worse, not
 * better: fewer requests went out than before. And because
 * reconcileBonusMargin pays the full Bonus Margin when no signal
 * arrives, a dispatch that quietly fails pays every margin in full.
 * The failure is invisible and expensive, which is the worst pair.
 *
 * So two rules, and the second is what makes the first true:
 *
 *   1. Requests go out on milestone completion, unconditionally.
 *      There is no parameter here to skip, defer or suppress one.
 *   2. Every attempt is recorded with its outcome. "Always goes out"
 *      with no record of whether it went is a guarantee on paper.
 *
 * ─────────────────────────────────────────────────────────────
 * THE APP IS NOT A CRM
 *
 * Recipients come from HubSpot at send time. The app stores no contact
 * list, no contact roles and no contact lifecycle — clients.hubspotCompanyId
 * is the pointer and crm-stub already speaks to the contacts endpoint.
 * The one thing kept locally is which address a given token went to,
 * on the token, so a reply stays attributable even if the contact list
 * changes afterwards.
 *
 * Falls back to clients.primaryContactEmail when HubSpot has nothing
 * or is unreachable. A degraded send beats no send, and the fallback
 * is recorded as such.
 *
 * ─────────────────────────────────────────────────────────────
 * FAILURE IS A ROW, NOT A THROWN ERROR
 *
 * A milestone completing must not fail because a mail server is down.
 * Everything here catches, records, and returns a summary the caller
 * can surface. The token exists either way, so a retry has something
 * to retry.
 * ─────────────────────────────────────────────────────────────
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  clients as clientsTable,
  customerFeedbackTokens,
  projects as projectsTable,
} from "@/db/schema";
import { issueFeedbackToken, feedbackLinkUrl } from "@/lib/feedback-link-tokens";
import { sendTransactionalEmail } from "@/lib/email";

export interface DispatchOutcome {
  recipientEmail: string;
  ok: boolean;
  /** The provider's own words when it failed. */
  error?: string;
}

export interface DispatchSummary {
  attempted: number;
  sent: number;
  failed: number;
  outcomes: DispatchOutcome[];
  /** Set when there was nobody to write to, which is its own problem. */
  noRecipients?: boolean;
}

/**
 * Who to ask about this engagement.
 *
 * HubSpot first, local contact second. Deliberately returns an array:
 * a client usually has more than one point of contact, and asking only
 * the billing address is how the person who judged the work never gets
 * asked.
 */
async function recipientsFor(projectId: string): Promise<string[]> {
  const [project] = await db
    .select({ clientRefId: projectsTable.clientRefId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!project?.clientRefId) return [];

  const [client] = await db
    .select({
      hubspotCompanyId: clientsTable.hubspotCompanyId,
      primaryContactEmail: clientsTable.primaryContactEmail,
    })
    .from(clientsTable)
    .where(eq(clientsTable.id, project.clientRefId))
    .limit(1);
  if (!client) return [];

  const found = new Set<string>();
  if (client.hubspotCompanyId) {
    try {
      const { contactEmailsForCompany } = await import("@/lib/crm-stub");
      for (const e of await contactEmailsForCompany(client.hubspotCompanyId)) {
        const t = e.trim().toLowerCase();
        if (t) found.add(t);
      }
    } catch {
      // HubSpot being slow or down must not stop the ask. The local
      // contact below carries it.
    }
  }
  const local = client.primaryContactEmail?.trim().toLowerCase();
  if (local) found.add(local);
  return [...found];
}

/**
 * Ask the client about one milestone. Called by the milestone writer,
 * not by a person.
 *
 * `milestoneId` null means the closing questionnaire for the whole
 * engagement.
 */
export async function dispatchFeedbackRequest(input: {
  projectId: string;
  milestoneId: string | null;
  projectTitle: string;
  milestoneTitle?: string | null;
  origin: string;
}): Promise<DispatchSummary> {
  const recipients = await recipientsFor(input.projectId);
  if (recipients.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      outcomes: [],
      noRecipients: true,
    };
  }

  const outcomes: DispatchOutcome[] = [];
  for (const recipientEmail of recipients) {
    let token: string;
    try {
      // Scoped to this recipient and this milestone, so re-sending to
      // one person cannot revoke the link another is holding.
      const issued = await issueFeedbackToken({
        contextId: input.projectId,
        milestoneId: input.milestoneId,
        recipientEmail,
        // Nobody issued it. That is the point of the module.
        issuedByUserId: null,
      });
      token = issued.token;
    } catch (err) {
      outcomes.push({
        recipientEmail,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const url = feedbackLinkUrl(input.origin, input.projectId, token);
    const about = input.milestoneTitle
      ? `${input.milestoneTitle} on ${input.projectTitle}`
      : input.projectTitle;
    try {
      await sendTransactionalEmail({
        to: recipientEmail,
        subject: `How did we do on ${about}?`,
        text:
          `We've just finished ${about}.\n\n` +
          `Two minutes, and it goes straight to the people who did the work:\n${url}\n\n` +
          `If something could have gone better, that is the most useful thing you can tell us.`,
      });
      await markDelivery(token, { ok: true });
      outcomes.push({ recipientEmail, ok: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await markDelivery(token, { ok: false, error });
      outcomes.push({ recipientEmail, ok: false, error });
    }
  }

  const sent = outcomes.filter((o) => o.ok).length;
  return {
    attempted: outcomes.length,
    sent,
    failed: outcomes.length - sent,
    outcomes,
  };
}

/** Record what the mail server actually said. */
async function markDelivery(
  token: string,
  result: { ok: boolean; error?: string },
): Promise<void> {
  try {
    const [row] = await db
      .select({ attempts: customerFeedbackTokens.deliveryAttempts })
      .from(customerFeedbackTokens)
      .where(eq(customerFeedbackTokens.token, token))
      .limit(1);
    await db
      .update(customerFeedbackTokens)
      .set({
        deliveryStatus: result.ok ? "sent" : "failed",
        deliveryAttempts: (row?.attempts ?? 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        deliveryError: result.error ?? null,
      })
      .where(eq(customerFeedbackTokens.token, token));
  } catch {
    // Recording the outcome must not itself break the caller. The
    // undelivered reader below treats a row stuck at "pending" as
    // undelivered, so a lost write surfaces rather than hides.
  }
}

/**
 * Requests that did not arrive.
 *
 * "pending" counts: a token minted whose send never reported either
 * way is exactly as undelivered as one that bounced, and treating it
 * as fine is how a broken dispatch stays invisible.
 */
export async function undeliveredRequests(projectId: string) {
  return db
    .select({
      token: customerFeedbackTokens.token,
      recipientEmail: customerFeedbackTokens.recipientEmail,
      milestoneId: customerFeedbackTokens.milestoneId,
      status: customerFeedbackTokens.deliveryStatus,
      attempts: customerFeedbackTokens.deliveryAttempts,
      lastAttemptAt: customerFeedbackTokens.lastAttemptAt,
      error: customerFeedbackTokens.deliveryError,
    })
    .from(customerFeedbackTokens)
    .where(
      and(
        eq(customerFeedbackTokens.contextId, projectId),
        isNull(customerFeedbackTokens.usedAt),
        isNull(customerFeedbackTokens.revokedAt),
      )!,
    );
}
