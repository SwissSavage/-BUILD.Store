/**
 * Voucher status transitions, against Postgres.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Issuance was already correct: voucher-issuance.ts writes to
 * build_vouchers inside a transaction holding pg_advisory_xact_lock,
 * so the supply cap is genuinely enforced.
 *
 * Everything around it was not. The four status transitions in
 * voucher-actions.ts found a row in MOCK_BUILD_VOUCHERS and mutated it
 * in place, so an admin queued a voucher for swap, watched it move,
 * and found it back to unswapped after the next restart. The audit log
 * recorded a transition that had not happened to any real row.
 *
 * The transitions are guarded on the expected current status rather
 * than read-then-write, so two admins acting at once cannot both
 * believe they queued the same voucher. On money, a lost update is
 * worse than a refused one.
 * ─────────────────────────────────────────────────────────────
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { buildVouchers } from "@/db/schema";
import type { BuildVoucher } from "@/lib/types";

type SwapStatus = BuildVoucher["swapStatus"];

/** Load one voucher, or null. */
export async function getVoucherById(
  id: string,
): Promise<BuildVoucher | null> {
  const [row] = await db
    .select()
    .from(buildVouchers)
    .where(eq(buildVouchers.id, id))
    .limit(1);
  return (row as unknown as BuildVoucher) ?? null;
}

/**
 * Move a voucher between swap states.
 *
 * Guarded on `from`, so the UPDATE only matches when the row is still
 * in the status the caller believed it was. A zero-row result means
 * someone else moved it first, which is reported rather than
 * overwritten.
 */
export async function transitionVoucher(
  id: string,
  from: SwapStatus,
  to: SwapStatus,
  extra: Partial<Record<"swappedAt" | "forfeitedAt", string | null>> = {},
): Promise<BuildVoucher> {
  const updated = await db
    .update(buildVouchers)
    .set({ swapStatus: to, updatedAt: new Date().toISOString(), ...extra })
    .where(and(eq(buildVouchers.id, id), eq(buildVouchers.swapStatus, from)))
    .returning();

  if (updated.length === 0) {
    const current = await getVoucherById(id);
    if (!current) throw new Error("Voucher not found.");
    throw new Error(
      `This voucher is ${current.swapStatus}, not ${from}. Someone may have changed it already. Reload and try again.`,
    );
  }
  return updated[0] as unknown as BuildVoucher;
}

/** Every voucher held by one member, newest first. */
export async function getVouchersForUser(
  userId: string,
): Promise<BuildVoucher[]> {
  const rows = await db
    .select()
    .from(buildVouchers)
    .where(eq(buildVouchers.userId, userId));
  return (rows as unknown as BuildVoucher[]).sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
}
