/**
 * Which account a client pays into, and what name they will see.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03)
 *
 * Jamar: "what I'm hoping for is an invoice request that comes from
 * our app to the client, so they aren't confused about bank terms
 * because the DBA is different... we can setup railing for Mercury,
 * but until he opens up the account or abides by the rules this is how
 * we have to do it for now." And then: "If we could have a dropdown
 * for account association in the invoice creation process that would
 * be ideal."
 *
 * The client contracts with Future Modern and then sees a different
 * name on the payee line, because the receiving account is not the one
 * the company name points at. That gap is where a client stops and
 * emails to ask whether they are being phished. The invoice coming
 * from our own surface is what fixes it: the document is Future
 * Modern's, and the document is what explains the name before they
 * have to ask.
 *
 * Which account receives the money is a per-invoice decision, not a
 * deployment-wide one, because more than one is live at a time and the
 * right one depends on the engagement.
 *
 * WHY THE ACCOUNTS LIVE IN ENV AND THE INVOICE STORES ONLY AN ID
 *
 * This repository is public, so real routing and account numbers can
 * never be in source. That is why the client invoice page has carried
 * XXXXXXXXX placeholders since it was written.
 *
 * Putting them in the database instead would be worse than it looks:
 * they would enter every backup, every restore rehearsal, and any
 * admin surface that renders them. Keeping them in Dokploy env means
 * the invoice row stores `remitAccountId`, a label like "found" that
 * discloses nothing on its own, and the numbers exist in exactly one
 * place that is not the repo and not a backup. Adding the Mercury
 * account later is an env change, not a migration.
 *
 * WHY THE PAGE NEVER SHOWS FULL COORDINATES
 *
 * A client token is a bearer credential in a URL. Treating it as good
 * enough to show an amount owed is a different risk decision from
 * treating it as good enough to publish an account number. The page
 * names the payee, the bank and the reference, which is what answers
 * "is this really you". The coordinates go in the email to the named
 * billing contact, which is what the page has always promised.
 * ─────────────────────────────────────────────────────────────
 */

export interface RemitAccount {
  /** Stable key stored on the invoice. Discloses nothing by itself. */
  id: string;
  /** What the admin picks from the dropdown. */
  label: string;
  /**
   * The name on the receiving account, exactly as it appears on the
   * client's statement. Surfaced deliberately: this is the DBA
   * mismatch that makes a client hesitate.
   */
  payeeName: string;
  bankName?: string;
  /** Human label for the rail, e.g. "ACH or wire". */
  railLabel?: string;
  /** Email only. Never rendered on a token-reachable page. */
  achRouting?: string;
  accountNumber?: string;
}

/**
 * REMIT_ACCOUNTS is a JSON array of RemitAccount. Example, with real
 * numbers set in Dokploy and never here:
 *
 *   [{"id":"found","label":"Found (current)","payeeName":"<DBA>",
 *     "bankName":"Found","railLabel":"ACH","achRouting":"…",
 *     "accountNumber":"…"}]
 *
 * Parsed per call rather than at module load, so a Dokploy change
 * takes effect on restart without a rebuild.
 */
export function remitAccounts(): RemitAccount[] {
  const raw = (process.env.REMIT_ACCOUNTS ?? "").trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything without an id, a label and a payee name is unusable on
    // an invoice, and a half-configured account is more dangerous than
    // none: it would render a payee line the client cannot verify.
    return parsed.filter(
      (a): a is RemitAccount =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as RemitAccount).id === "string" &&
        typeof (a as RemitAccount).label === "string" &&
        typeof (a as RemitAccount).payeeName === "string",
    );
  } catch {
    // A malformed value must not take the invoice page down. An empty
    // list renders the "coordinates will be emailed" fallback, which
    // is honest rather than wrong.
    // eslint-disable-next-line no-console
    console.error("[remit] REMIT_ACCOUNTS is not valid JSON; ignoring.");
    return [];
  }
}

export function remitAccountById(id: string | null): RemitAccount | null {
  if (!id) return null;
  return remitAccounts().find((a) => a.id === id) ?? null;
}

/** First configured account, used as the dropdown's default. */
export function defaultRemitAccount(): RemitAccount | null {
  return remitAccounts()[0] ?? null;
}

/**
 * The sentence that defuses the DBA question, or null when the payee
 * already matches the legal name and there is nothing to explain.
 *
 * Written for somebody about to send money who wants to know why the
 * name changed. It says the mismatch is expected before they ask.
 */
export function payeeExplanation(
  account: RemitAccount | null,
  legalName: string = "Future Modern Builderberg LLC",
): string | null {
  if (!account) return null;
  if (account.payeeName === legalName) return null;
  return `Payments are received as ${account.payeeName}, the banking name for ${legalName}. That is the name that will appear on your statement.`;
}
