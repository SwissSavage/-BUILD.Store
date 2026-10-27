/**
 * Issue, resolve and revoke the client's tracker link.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-24)
 *
 * /contracts/[id]/tracker gated on a map written into the page file:
 *
 *   const CLIENT_TRACKER_TOKENS = { demo: "*", ... }
 *
 * `demo` matched every project id. Anyone appending ?token=demo read
 * the milestone titles, descriptions, due dates, owner names and client
 * label of any contract in the database.
 *
 * This is the same bug that was found on the feedback page on
 * 2026-09-04 and fixed there with customer_feedback_tokens. The fix
 * did not travel to the file next door.
 *
 * WHY ONE MODULE
 *
 * Same reason feedback-link-tokens.ts is one module: a link is valid if
 * it exists, is unrevoked, unexpired, and points at the project in the
 * URL. Splitting resolve from issue across two files is how the page
 * ends up checking three of those and the admin surface two.
 *
 * NOT A SESSION
 *
 * Holding the token proves nothing about who the person is, only that
 * someone gave them the link. Same posture as /invoices/[token] and
 * /receipts/[token], which is why it expires.
 *
 * WHY THE TTL IS LONG
 *
 * A tracker is checked across the whole engagement, so a 45-day
 * questionnaire TTL would expire mid-project and read to the client as
 * the project having been cancelled. A year, revocable at any time, and
 * reissue is one click.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { projectTrackerTokens } from "@/db/schema";
import { secureToken } from "@/lib/secure-token";

export const TRACKER_LINK_TTL_DAYS = 365;

export type TrackerTokenRejection =
  | "unknown"
  | "wrong_project"
  | "expired"
  | "revoked";

export interface TrackerTokenResolution {
  ok: boolean;
  reason: TrackerTokenRejection | null;
  tokenId: string | null;
}

/**
 * Is this token good for this project, right now?
 *
 * Returns a reason rather than throwing, because the caller is a page a
 * client opens from an email and a thrown error renders as a blank
 * error screen with no explanation.
 */
export async function resolveTrackerToken(
  token: string | undefined,
  projectId: string,
): Promise<TrackerTokenResolution> {
  const miss: TrackerTokenResolution = {
    ok: false,
    reason: "unknown",
    tokenId: null,
  };
  const value = token?.trim();
  if (!value) return miss;

  const [row] = await db
    .select()
    .from(projectTrackerTokens)
    .where(eq(projectTrackerTokens.token, value))
    .limit(1);
  if (!row) return miss;

  const found = { tokenId: row.id };

  // Wrong project is a real token for a different engagement. The page
  // tells the holder only that the link is not valid: confirming that
  // their token is real but belongs elsewhere confirms that engagement
  // exists.
  if (row.projectId !== projectId) {
    return { ok: false, reason: "wrong_project", ...found };
  }
  if (row.revokedAt) return { ok: false, reason: "revoked", ...found };
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: "expired", ...found };
  }
  return { ok: true, reason: null, ...found };
}

/**
 * Record that the link was opened.
 *
 * Deliberately separate from resolve and deliberately not awaited by
 * the page: a write that fails must not stop a client seeing their
 * tracker, and this is a usage signal, not a credential check.
 */
export async function touchTrackerToken(tokenId: string): Promise<void> {
  await db
    .update(projectTrackerTokens)
    .set({ lastViewedAt: new Date().toISOString() })
    .where(eq(projectTrackerTokens.id, tokenId));
}

/**
 * Mint a link for one project.
 *
 * Reissuing revokes whatever was outstanding first, so "send them a
 * fresh one" cannot leave two live credentials for the same engagement
 * in circulation.
 */
export async function issueTrackerToken(input: {
  projectId: string;
  issuedByUserId: string | null;
  ttlDays?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("A project id is required to issue a link.");

  const now = new Date();
  const ttl = input.ttlDays ?? TRACKER_LINK_TTL_DAYS;
  const expiresAt = new Date(
    now.getTime() + ttl * 24 * 60 * 60 * 1000,
  ).toISOString();
  const token = secureToken("trk");

  await db
    .update(projectTrackerTokens)
    .set({ revokedAt: now.toISOString() })
    .where(
      and(
        eq(projectTrackerTokens.projectId, projectId),
        isNull(projectTrackerTokens.revokedAt),
      )!,
    );

  await db.insert(projectTrackerTokens).values({
    id: `trkt_${randomUUID()}`,
    token,
    projectId,
    issuedByUserId: input.issuedByUserId,
    issuedAt: now.toISOString(),
    expiresAt,
    lastViewedAt: null,
    revokedAt: null,
  });

  return { token, expiresAt };
}

/** Kill the outstanding link without minting a replacement. */
export async function revokeTrackerTokens(projectId: string): Promise<number> {
  const killed = await db
    .update(projectTrackerTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(projectTrackerTokens.projectId, projectId),
        isNull(projectTrackerTokens.revokedAt),
      )!,
    )
    .returning({ id: projectTrackerTokens.id });
  return killed.length;
}

/** The live link for a project, if one is outstanding. Admin surface. */
export async function getLiveTrackerToken(projectId: string) {
  const rows = await db
    .select()
    .from(projectTrackerTokens)
    .where(
      and(
        eq(projectTrackerTokens.projectId, projectId),
        isNull(projectTrackerTokens.revokedAt),
      )!,
    );
  const live = rows
    .filter((r) => new Date(r.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  return live[0] ?? null;
}

/** Build the client-facing URL for a token. */
export function trackerLinkUrl(
  origin: string,
  projectId: string,
  token: string,
): string {
  return `${origin.replace(/\/$/, "")}/contracts/${projectId}/tracker?token=${token}`;
}
