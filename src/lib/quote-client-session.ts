/**
 * Reading the current client's verified identity on a quote.
 *
 * Separate from quote-verification-actions.ts because that file carries
 * "use server" and may only export async functions, and because the
 * quote actions need to read a session without importing the whole
 * request/verify surface.
 */
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { quoteClientVerifications } from "@/db/schema";

/**
 * One cookie per quote. A client who has verified on one proposal has
 * not verified on another, and a shared browser cannot carry an
 * identity across two deals.
 */
export function quoteSessionCookieName(clientToken: string): string {
  return `fm_quote_${clientToken.slice(0, 24)}`;
}

/** The code is never stored, only this. */
export function hashAccessCode(quoteId: string, code: string): string {
  return createHash("sha256").update(`${quoteId}:${code}`).digest("hex");
}

/** Six digits. Long enough against five guesses, short enough to retype. */
export function generateAccessCode(): string {
  // randomInt would be cleaner but randomBytes keeps this synchronous
  // and the modulo bias across 2^32 into 10^6 is immaterial here.
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export interface VerifiedQuoteClient {
  email: string;
  name: string;
  verifiedAt: string;
}

/**
 * Who the browser has proved it is on this quote, if anyone.
 *
 * Returns null rather than throwing, so a page can render the proposal
 * to an unverified reader and only the decision controls care.
 */
export async function getVerifiedQuoteClient(
  quoteId: string,
  clientToken: string,
): Promise<VerifiedQuoteClient | null> {
  const jar = await cookies();
  const sessionToken = jar.get(quoteSessionCookieName(clientToken))?.value;
  if (!sessionToken) return null;

  const [row] = await db
    .select()
    .from(quoteClientVerifications)
    .where(
      and(
        eq(quoteClientVerifications.sessionToken, sessionToken),
        // Scoped to this quote, so a session token lifted from one
        // proposal cannot decide another.
        eq(quoteClientVerifications.quoteId, quoteId),
        isNotNull(quoteClientVerifications.verifiedAt),
        gt(quoteClientVerifications.expiresAt, new Date().toISOString()),
      )!,
    )
    .limit(1);

  if (!row || !row.verifiedAt) return null;
  return { email: row.email, name: row.name, verifiedAt: row.verifiedAt };
}
