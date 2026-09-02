/**
 * Record the paperwork a member signed during the invite ceremony.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Nothing inserted into `agreements` on the invite path. The Documenso
 * webhook's invite branch returns "invitee completed. No action
 * (ceremony flow drives)", and the ceremony carried a
 * `TODO: persist dataOptIn` with a `void dataOptIn` under it. So a
 * member signed an LOI through Documenso, the envelope completed, and
 * no row existed anywhere in FM to say so.
 *
 * Billy: "my signed agreements etc are showing up as if I haven't done
 * anything, whereas I should see at least 1 signed agreement and 1
 * proposal sent." He was right, and pointing /profile at Postgres was
 * only half of it. The other half was that there was nothing to read.
 *
 * This matters beyond a missing panel. The public profile is the
 * portfolio members share to win work, and signed paperwork is part of
 * what makes it credible. It is also the cooperative's own record of
 * what someone agreed to and when, which is not something to be
 * reconstructing from a third party's dashboard later.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agreements } from "@/db/schema";

type AgreementType =
  | "talent_data"
  | "membership_covenant"
  | "loi"
  | "seller_agreement"
  | "contributor_agreement"
  | "other";

interface RecordInput {
  userId: string;
  agreementType: AgreementType;
  provider: "documenso" | "in_app";
  /** Documenso envelope id, or the invite code for in-app consent. */
  externalRef: string | null;
  documensoEnvelopeId?: string | null;
  notes?: string | null;
}

/**
 * Insert one agreement row, skipping it if the same one is already
 * recorded.
 *
 * Idempotency is on (userId, agreementType, externalRef). The ceremony
 * can be re-entered — a refresh, a retried webhook, a double submit —
 * and a member's paperwork list must not grow a duplicate every time.
 * There is no unique index for this yet, so the check is a read before
 * the write; the race window is small and the cost of losing it is one
 * duplicate row rather than anything harmful.
 */
export async function recordAgreement(input: RecordInput): Promise<void> {
  const existing = await db
    .select({ id: agreements.id })
    .from(agreements)
    .where(
      and(
        eq(agreements.userId, input.userId),
        eq(agreements.agreementType, input.agreementType),
        input.externalRef
          ? eq(agreements.externalRef, input.externalRef)
          : eq(agreements.userId, input.userId),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  const now = new Date().toISOString();
  await db.insert(agreements).values({
    id: `agr_${randomUUID()}`,
    userId: input.userId,
    agreementType: input.agreementType,
    version: "1.0",
    signedAt: now,
    provider: input.provider,
    externalRef: input.externalRef,
    storageUrl: null,
    notes: input.notes ?? null,
    documensoEnvelopeId: input.documensoEnvelopeId ?? null,
    signatureStatus: input.provider === "documenso" ? "completed" : null,
    signatureCompletedAt: input.provider === "documenso" ? now : null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Everything the invite ceremony should have on file once someone
 * completes it.
 *
 * Best-effort by design, and loud on failure. The member has already
 * signed and the invite is already consumed by the time this runs, so
 * throwing here would fail a signup that actually succeeded — the same
 * inversion that had contractors seeing errors for proposals that
 * saved. A missing row can be backfilled; a blocked signup cannot be
 * un-blocked after the fact.
 */
export async function recordInviteCeremonyAgreements(input: {
  userId: string;
  inviteCode: string;
  targetTier: string;
  documensoDocumentId: string | null;
  dataOptIn: boolean;
}): Promise<void> {
  try {
    // Partners sign an LOI; members sign the membership covenant.
    // Anything else that reaches here is recorded rather than dropped.
    const signedType: AgreementType =
      input.targetTier === "member" ? "membership_covenant" : "loi";

    await recordAgreement({
      userId: input.userId,
      agreementType: signedType,
      provider: "documenso",
      externalRef: input.documensoDocumentId ?? `invite:${input.inviteCode}`,
      documensoEnvelopeId: input.documensoDocumentId,
      notes: `Signed during the invite ceremony (invite ${input.inviteCode}).`,
    });

    // Tier-2 data participation. The checkbox has existed since the
    // ceremony was built and its value was discarded.
    if (input.dataOptIn) {
      await recordAgreement({
        userId: input.userId,
        agreementType: "talent_data",
        provider: "in_app",
        externalRef: `invite:${input.inviteCode}`,
        notes: "Opted in to Tier-2 data participation during signup.",
      });
    }
  } catch (err) {
    console.error(
      `INVITE_AGREEMENT_RECORD_FAILED invite=${input.inviteCode} user=${input.userId}`,
      err,
    );
  }
}
