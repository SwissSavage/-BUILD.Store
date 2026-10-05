/**
 * The client proves they control the mailbox before they decide.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05)
 *
 * approveCooperativeQuote, declineCooperativeQuote and
 * undoCooperativeQuoteDecision each took the client token and nothing
 * else. Anyone holding the URL could approve the engagement, pick which
 * builder led it, and type any name and address, which then became the
 * address the SOW envelope went to.
 *
 * Reading stays open. A champion forwarding the proposal up the ladder
 * is the motion working, and a sign-in wall in front of the CFO kills
 * the forward you wanted. Only the decision needs an identity.
 *
 * It checks the mailbox, not the person. No allowlist, no domain rule:
 * real buyers sign from personal addresses, a quote only ever reaches
 * people close to the deal, and someone who signs without the authority
 * to sign is answerable for having signed. What this stops is an
 * anonymous or invented address ending up on an agreement.
 *
 * Two actions return their result rather than throwing, because Next
 * redacts server action error messages in production and a thrown error
 * renders as a blank page. Same useActionState shape as ApplyToJobForm.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { cooperativeQuotes, quoteClientVerifications } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email";
import {
  generateAccessCode,
  generateSessionToken,
  hashAccessCode,
  quoteSessionCookieName,
} from "@/lib/quote-client-session";

/** Long enough to read an email and come back, short enough to matter. */
const CODE_TTL_MINUTES = 15;
/** How long a verified session lasts before they confirm again. */
const SESSION_TTL_HOURS = 12;
const MAX_ATTEMPTS = 5;

export type QuoteVerificationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function loadSentQuote(token: string) {
  const [quote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.clientToken, token))
    .limit(1);
  if (!quote) return null;
  // A draft has not been sent, so there is nobody to verify.
  if (quote.status === "draft") return null;
  return quote;
}

/**
 * Send a one-time code to the address the client wants to sign as.
 *
 * Deliberately gives the same answer whether or not the code went out,
 * so this cannot be used to test which addresses are already on a
 * quote. The only failures reported are the caller's own input.
 */
export async function requestQuoteAccessCode(
  _prev: QuoteVerificationResult | null,
  formData: FormData,
): Promise<QuoteVerificationResult> {
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (name.length < 2) {
    return { ok: false, error: "Enter the name the agreement should be addressed to." };
  }

  const quote = await loadSentQuote(token);
  if (!quote) {
    return { ok: false, error: "This proposal is no longer available." };
  }

  const now = new Date();
  const code = generateAccessCode();

  // One live request per quote and address. Asking again replaces the
  // outstanding code rather than leaving several valid at once, and
  // resets the attempt counter so a typo does not lock someone out
  // for good.
  await db
    .delete(quoteClientVerifications)
    .where(
      and(
        eq(quoteClientVerifications.quoteId, quote.id),
        eq(quoteClientVerifications.email, email),
        isNull(quoteClientVerifications.verifiedAt),
      )!,
    );

  await db.insert(quoteClientVerifications).values({
    id: `qcv_${randomUUID()}`,
    quoteId: quote.id,
    email,
    name,
    codeHash: hashAccessCode(quote.id, code),
    sessionToken: null,
    attempts: 0,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
    verifiedAt: null,
  });

  await sendTransactionalEmail({
    to: email,
    subject: `Your code to sign off on the Future Modern proposal`,
    text: [
      `Your code is ${code}`,
      ``,
      `Enter it on the proposal page to approve or decline.`,
      `It expires in ${CODE_TTL_MINUTES} minutes.`,
      ``,
      `If you were not expecting this, you can ignore it. Nothing happens`,
      `until the code is entered.`,
    ].join("\n"),
    html: `<p>Your code is <strong style="font-size:20px;letter-spacing:3px">${code}</strong></p>
<p>Enter it on the proposal page to approve or decline. It expires in ${CODE_TTL_MINUTES} minutes.</p>
<p style="color:#666">If you were not expecting this, you can ignore it. Nothing happens until the code is entered.</p>`,
  });

  return {
    ok: true,
    message: `Code sent to ${email}. It expires in ${CODE_TTL_MINUTES} minutes.`,
  };
}

/**
 * Check the code and open a session scoped to this one quote.
 *
 * Attempts are counted on the row rather than per request, so five
 * wrong guesses spends the code no matter how the guesses arrive.
 */
export async function verifyQuoteAccessCode(
  _prev: QuoteVerificationResult | null,
  formData: FormData,
): Promise<QuoteVerificationResult> {
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();

  const quote = await loadSentQuote(token);
  if (!quote) {
    return { ok: false, error: "This proposal is no longer available." };
  }

  const [row] = await db
    .select()
    .from(quoteClientVerifications)
    .where(
      and(
        eq(quoteClientVerifications.quoteId, quote.id),
        eq(quoteClientVerifications.email, email),
        isNull(quoteClientVerifications.verifiedAt),
        gt(quoteClientVerifications.expiresAt, new Date().toISOString()),
      )!,
    )
    .orderBy(desc(quoteClientVerifications.createdAt))
    .limit(1);

  if (!row) {
    return {
      ok: false,
      error: "That code has expired or was never sent. Ask for a new one.",
    };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many attempts on this code. Ask for a new one.",
    };
  }

  if (row.codeHash !== hashAccessCode(quote.id, code)) {
    await db
      .update(quoteClientVerifications)
      .set({ attempts: row.attempts + 1 })
      .where(eq(quoteClientVerifications.id, row.id));
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      error:
        left > 0
          ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "That code is not right, and this one is now spent. Ask for a new one.",
    };
  }

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_HOURS * 3_600_000,
  ).toISOString();

  // Guarded on still being unverified, so two tabs submitting the same
  // correct code do not mint two sessions off one row.
  const claimed = await db
    .update(quoteClientVerifications)
    .set({ sessionToken, verifiedAt: new Date().toISOString(), expiresAt })
    .where(
      and(
        eq(quoteClientVerifications.id, row.id),
        isNull(quoteClientVerifications.verifiedAt),
      )!,
    )
    .returning({ id: quoteClientVerifications.id });
  if (claimed.length === 0) {
    return { ok: false, error: "That code has already been used." };
  }

  const jar = await cookies();
  jar.set(quoteSessionCookieName(token), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3_600,
  });

  return { ok: true, message: `Verified as ${email}.` };
}
