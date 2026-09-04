/**
 * Issue, resolve and spend the client questionnaire link.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-04)
 *
 * /contracts/[id]/feedback gated on a map written into the page file:
 * three tokens for three seed contracts. Nothing added to it, so no
 * real client had a working link and none could be made. The admin
 * fallback on /admin/reserve hard-requires a linked meeting minute, so
 * a written report emailed over could not be captured either. Both
 * doors shut, with the CVC engagement report expected.
 *
 * WHY ONE MODULE RATHER THAN A READER AND A WRITER
 *
 * The three operations are one rule: a link is valid if it exists, is
 * unspent, unrevoked, unexpired, and points at the contract in the URL.
 * Splitting resolve from spend across two files is how the page ends up
 * checking four of those and the submit path three. The page and the
 * submit action call the same `resolveFeedbackToken`, so they cannot
 * disagree about what a valid link is.
 *
 * This module is not "use server". It exports non-async helpers and is
 * called from both a page and a server action.
 *
 * NOT A SESSION
 *
 * Holding the token proves nothing about who the person is. It only
 * proves someone gave them the link. That is the same posture as
 * /invoices/[token] and /receipts/[token], and it is why the token
 * carries an expiry and a single use rather than living forever.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { customerFeedbackTokens } from "@/db/schema";
import { secureToken } from "@/lib/secure-token";

/** How long an issued questionnaire link stays good. */
export const FEEDBACK_LINK_TTL_DAYS = 45;

export type FeedbackTokenRejection =
  | "unknown"
  | "wrong_contract"
  | "expired"
  | "already_used"
  | "revoked";

export interface FeedbackTokenResolution {
  ok: boolean;
  reason: FeedbackTokenRejection | null;
  tokenId: string | null;
  contextId: string | null;
}

/**
 * Is this token good for this contract, right now?
 *
 * Returns a reason rather than throwing, because the caller is a public
 * page that has to render something civil to a client whose link
 * expired, and a thrown error in production renders as a blank error
 * page with no explanation at all.
 */
export async function resolveFeedbackToken(
  token: string | undefined,
  contextId: string,
): Promise<FeedbackTokenResolution> {
  const miss: FeedbackTokenResolution = {
    ok: false,
    reason: "unknown",
    tokenId: null,
    contextId: null,
  };
  if (!token || !token.trim()) return miss;

  const [row] = await db
    .select()
    .from(customerFeedbackTokens)
    .where(eq(customerFeedbackTokens.token, token.trim()))
    .limit(1);

  if (!row) return miss;

  const found = { tokenId: row.id, contextId: row.contextId };

  // Wrong contract is reported as unknown to the client. Telling a
  // link holder that their token is real but belongs to a different
  // engagement confirms the existence of that engagement.
  if (row.contextId !== contextId) {
    return { ok: false, reason: "wrong_contract", ...found };
  }
  if (row.revokedAt) return { ok: false, reason: "revoked", ...found };
  if (row.usedAt) return { ok: false, reason: "already_used", ...found };
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: "expired", ...found };
  }
  return { ok: true, reason: null, ...found };
}

/**
 * Mint a link for one contract.
 *
 * Reissuing revokes whatever was outstanding for that contract first,
 * so "send them a fresh one" cannot leave two live credentials for the
 * same engagement in circulation.
 */
export async function issueFeedbackToken(input: {
  contextId: string;
  contextKind?: "contract" | "order";
  issuedByUserId: string | null;
  ttlDays?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const contextId = input.contextId.trim();
  if (!contextId) throw new Error("A contract id is required to issue a link.");

  const now = new Date();
  const ttl = input.ttlDays ?? FEEDBACK_LINK_TTL_DAYS;
  const expiresAt = new Date(
    now.getTime() + ttl * 24 * 60 * 60 * 1000,
  ).toISOString();
  const token = secureToken("cfq");

  await db
    .update(customerFeedbackTokens)
    .set({ revokedAt: now.toISOString() })
    .where(
      and(
        eq(customerFeedbackTokens.contextId, contextId),
        isNull(customerFeedbackTokens.usedAt),
        isNull(customerFeedbackTokens.revokedAt),
      )!,
    );

  await db.insert(customerFeedbackTokens).values({
    id: `cfqt_${randomUUID()}`,
    token,
    contextKind: input.contextKind ?? "contract",
    contextId,
    issuedByUserId: input.issuedByUserId,
    issuedAt: now.toISOString(),
    expiresAt,
    usedAt: null,
    revokedAt: null,
  });

  return { token, expiresAt };
}

/**
 * Spend the token. Guarded on it still being unspent, so two submits
 * racing the same link produce one accepted questionnaire.
 *
 * Returns false when the token was already spent. The caller decides
 * whether that is fatal; it is, because the feedback row is what the
 * bonus gate reads.
 */
export async function consumeFeedbackToken(token: string): Promise<boolean> {
  const spent = await db
    .update(customerFeedbackTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(
      and(
        eq(customerFeedbackTokens.token, token.trim()),
        isNull(customerFeedbackTokens.usedAt),
        isNull(customerFeedbackTokens.revokedAt),
      )!,
    )
    .returning({ id: customerFeedbackTokens.id });
  return spent.length > 0;
}

/** The live link for a contract, if one is outstanding. Admin surface. */
export async function getLiveFeedbackToken(contextId: string) {
  const rows = await db
    .select()
    .from(customerFeedbackTokens)
    .where(
      and(
        eq(customerFeedbackTokens.contextId, contextId),
        isNull(customerFeedbackTokens.usedAt),
        isNull(customerFeedbackTokens.revokedAt),
      )!,
    );
  const live = rows
    .filter((r) => new Date(r.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  return live[0] ?? null;
}

/** Build the client-facing URL for a token. */
export function feedbackLinkUrl(
  origin: string,
  contextId: string,
  token: string,
): string {
  return `${origin.replace(/\/$/, "")}/contracts/${contextId}/feedback?token=${token}`;
}
