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
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_MVP_SCORES } from "@/lib/mock-data/mvp-scores";
import {
  MOCK_CANONIZATIONS,
  canonizationForYear,
} from "@/lib/mock-data/canonizations";
import {
  MOCK_FUTURE_MODERNIST_RECOGNITIONS,
} from "@/lib/mock-data/future-modernist-recognitions";
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
  await requireAdmin();
  const yearRaw = Number(formData.get("year") ?? "0");
  if (!Number.isFinite(yearRaw) || yearRaw < 2020 || yearRaw > 2100) {
    throw new Error("Year must be a valid number.");
  }
  const year = Math.floor(yearRaw);

  const courtIds = new Set(
    championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS),
  );

  // Eligibility: active Members (always) + Partners with at least one
  // recognition in the year being canonized. Prospects/viewers excluded.
  const recognizedPartnerIds = new Set(
    MOCK_FUTURE_MODERNIST_RECOGNITIONS
      .filter((r) => {
        if (r.periodKind === "year") return r.periodLabel === String(year);
        // monthly periodKey is "YYYY-MM"
        return r.periodKey.startsWith(`${year}-`);
      })
      .map((r) => r.userId),
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const user of MOCK_USERS) {
    const isMember = user.membershipTier === "member";
    const isRecognizedPartner =
      user.membershipTier === "partner" && recognizedPartnerIds.has(user.id);
    if (!isMember && !isRecognizedPartner) continue;
    if (canonizationForYear(user.id, year)) {
      skippedCount++;
      continue;
    }

    const snapshot = MOCK_MVP_SCORES.find((s) => s.userId === user.id);
    const tier = deriveTradingCardTier({
      ovr: snapshot ? snapshot.ovr : null,
      isProvisional: snapshot?.isProvisional ?? false,
      isInChampionsCourt: courtIds.has(user.id),
    });
    const recognitionIds = MOCK_FUTURE_MODERNIST_RECOGNITIONS
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
    MOCK_CANONIZATIONS.push(row);
    createdCount++;
  }

  revalidatePath("/admin/mvp/canonization");
  for (const user of MOCK_USERS) {
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const row = MOCK_CANONIZATIONS.find((c) => c.id === id);
  if (!row) throw new Error("Canonization not found");
  row.caption = caption.length === 0 ? null : caption;

  const target = MOCK_USERS.find((u) => u.id === row.userId);
  revalidatePath("/admin/mvp/canonization");
  if (target) revalidatePath(`/u/${target.handle}`);
}
