/**
 * Annual canonization actions.
 *
 * The cooperative's year-end snapshot ritual: for every active Member
 * (and recognized Partner), record their standing at the moment, lock
 * the tier into a permanent row, then queue the on-chain mint cycle.
 *
 * Sandbox: write the rows into MOCK_CANONIZATIONS. Production: same
 * row writes, plus dispatch an ERC-721 mint per row via the FM
 * canonization contract, derive the ERC-6551 TBA address, and persist
 * tokenId + tbaAddress back onto the row.
 *
 * Admin-gated. Year-end automation in production fires from a cron
 * with admin sign-off; sandbox surfaces a single-click admin button.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  futureModernistRecognitions,
  memberCanonizations,
} from "@/db/schema";
import { getAllUsers, getUserById } from "@/lib/readers/users";
import { mvpScoreReader } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { championsCourtMembers } from "@/lib/mvp-score";
import { deriveTradingCardTier } from "@/components/TradingCard";
import type { MemberCanonization } from "@/lib/types";

function newCanonizationId(userId: string, year: number): string {
  return `canon_${year}_${userId.replace(/^u_/, "")}`;
}

/**
 * Canonize a year — snapshot every eligible Member + recognized Partner
 * at their current MVP standing. Idempotent for a given (year, user)
 * pair; existing rows are not overwritten so prior mints stay stable.
 *
 * Production: also queues the on-chain mint per new row.
 */
export async function canonizeYear(formData: FormData) {
  const admin = await requireAdmin();
  const yearRaw = Number(formData.get("year") ?? "0");
  if (!Number.isFinite(yearRaw) || yearRaw < 2020 || yearRaw > 2100) {
    throw new Error("Year must be a valid number.");
  }
  const year = Math.floor(yearRaw);

  // ─────────────────────────────────────────────────────────────
  // WHY EVERY READ HERE MOVED (2026-09-02)
  //
  // This walked MOCK_USERS, scored against MOCK_MVP_SCORES, and pushed
  // the result onto MOCK_CANONIZATIONS. Run against production it would
  // have canonized the seed cast and written the result to memory:
  // fictional people immortalised for a year, real members skipped,
  // and the whole thing gone on the next restart.
  //
  // /u/[handle] was switched to read canonizations from Postgres
  // earlier today, so the write had to follow or the ceremony would
  // produce nothing visible anywhere.
  // ─────────────────────────────────────────────────────────────
  const [{ users: roster }, allScores, yearRecognitions, existingRows] =
    await Promise.all([
      getAllUsers(),
      mvpScoreReader.all(),
      db.select().from(futureModernistRecognitions),
      db
        .select({ userId: memberCanonizations.userId })
        .from(memberCanonizations)
        .where(eq(memberCanonizations.year, year)),
    ]);

  const courtIds = new Set(championsCourtMembers(allScores, roster));
  const alreadyCanonized = new Set(existingRows.map((r) => r.userId));

  // Eligibility: active Members (always) + Partners with at least one
  // recognition in the year being canonized. Prospects/viewers excluded.
  const recognizedPartnerIds = new Set(
    yearRecognitions
      .filter((r) => {
        if (r.periodKind === "year") return r.periodLabel === String(year);
        // monthly periodKey is "YYYY-MM"
        return r.periodKey.startsWith(`${year}-`);
      })
      .map((r) => r.userId),
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const user of roster) {
    const isMember = user.membershipTier === "member";
    const isRecognizedPartner =
      user.membershipTier === "partner" && recognizedPartnerIds.has(user.id);
    if (!isMember && !isRecognizedPartner) continue;
    if (alreadyCanonized.has(user.id)) {
      skippedCount++;
      continue;
    }

    const snapshot = allScores.find((s) => s.userId === user.id) ?? null;
    const tier = deriveTradingCardTier({
      ovr: snapshot ? snapshot.ovr : null,
      isProvisional: snapshot?.isProvisional ?? false,
      isInChampionsCourt: courtIds.has(user.id),
    });
    const recognitionIds = yearRecognitions
      .filter((r) => {
        if (r.userId !== user.id) return false;
        if (r.periodKind === "year") return r.periodLabel === String(year);
        return r.periodKey.startsWith(`${year}-`);
      })
      .map((r) => r.id);

    const row: MemberCanonization = {
      id: newCanonizationId(user.id, year),
      userId: user.id,
      year,
      tier,
      ovr: snapshot ? snapshot.ovr : null,
      recognitionIds,
      caption: null,
      frozenAt: new Date().toISOString(),
      tokenId: null,
      tbaAddress: null,
    };
    await db.insert(memberCanonizations).values({
      id: row.id,
      userId: row.userId,
      year: row.year,
      tier: row.tier,
      ovr: row.ovr,
      recognitionIds: row.recognitionIds,
      caption: null,
      frozenAt: row.frozenAt,
      tokenId: null,
      tbaAddress: null,
    });
    createdCount++;

    await logAuditEvent({
      actorUserId: admin.id,
      actorRoleSnapshot: snapshotActorRole(admin),
      action: "canonization.frozen",
      resourceKind: "canonization",
      resourceId: row.id,
      before: null,
      after: {
        userId: row.userId,
        year: row.year,
        tier: row.tier,
        ovr: row.ovr,
        recognitionCount: row.recognitionIds.length,
      },
    });
  }

  revalidatePath("/admin/mvp/canonization");
  for (const user of roster) {
    revalidatePath(`/u/${user.handle}`);
  }
  void createdCount;
  void skippedCount;
}

/**
 * Admin appends a caption to a specific canonization. Captions surface
 * on the card as the one-line story for the year. Optional — many
 * cards ship without one.
 */
export async function setCanonizationCaption(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const [row] = await db
    .select({
      id: memberCanonizations.id,
      caption: memberCanonizations.caption,
      userId: memberCanonizations.userId,
    })
    .from(memberCanonizations)
    .where(eq(memberCanonizations.id, id))
    .limit(1);
  if (!row) throw new Error("Canonization not found");
  const before = row.caption;
  await db
    .update(memberCanonizations)
    .set({ caption: caption.length === 0 ? null : caption })
    .where(eq(memberCanonizations.id, id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "canonization.caption_updated",
    resourceKind: "canonization",
    resourceId: row.id,
    before: { caption: before },
    after: { caption: caption.length === 0 ? null : caption },
  });

  const target = await getUserById(row.userId);
  revalidatePath("/admin/mvp/canonization");
  if (target) revalidatePath(`/u/${target.handle}`);
}
