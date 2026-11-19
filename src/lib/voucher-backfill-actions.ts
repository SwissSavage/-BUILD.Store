"use server";

/**
 * Issue the $BUILD for a contract that settled without it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-11-19)
 *
 * Jamar: "the token vouchers should flow at completion as well."
 *
 * They are supposed to. The settle page calls
 * issueBuildFromSettlement alongside the cash split. But the call is
 * wrapped in a try whose catch is a console.error and nothing else:
 *
 *   } catch (err) {
 *     console.error(`[contract-settle] issueBuildFromSettlement
 *                     failed for ${contractId}:`, err);
 *   }
 *
 * Best-effort is the right call there, for the reason the file gives
 * about remittances: settlement has already happened and a failure
 * downstream of the money must not unwind a payment. The mistake is
 * that the failure then goes nowhere. Settlement reports success, the
 * contract files itself under Settled, and the contributors are owed
 * $BUILD that does not exist. The only trace is a container log.
 *
 * So this is the repair path: a contract that settled and has no
 * vouchers against it can be given them without re-running
 * settlement and without touching the cash.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THE EXISTING-VOUCHER CHECK IS NOT OPTIONAL
 *
 * issueBuildFromSettlement has NO idempotency guard. It assembles the
 * cascade and writes it. Called twice it issues twice, silently, and
 * $BUILD is a balance people can spend.
 *
 * The guard therefore lives here, before the call, and it is the
 * whole reason this is a separate action rather than a retry button
 * wired straight to the issuer.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THE INPUTS COME FROM THE SPLITS
 *
 * Not recomputed from attribution. The revenue splits are what the
 * cash was actually paid on, so deriving the voucher cascade from
 * them guarantees the two agree about who contributed and in what
 * proportion. Recomputing would let the $BUILD disagree with the
 * money for the same engagement, which is the class of bug the
 * remittance snapshot rule exists to prevent.
 * ─────────────────────────────────────────────────────────────
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { buildVouchers, projects, revenueSplits } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { issueBuildFromSettlement } from "@/lib/voucher-issuance";

export interface VoucherBackfillResult {
  ok: boolean;
  message: string;
}

export async function issueVouchersForSettledContract(
  formData: FormData,
): Promise<VoucherBackfillResult> {
  // Inlined rather than wrapped: check-server-action-auth matches the
  // auth call inside each exported function body.
  const admin = await requireAdmin();

  const contractId = String(formData.get("contractId") ?? "").trim();
  if (!contractId) return { ok: false, message: "Missing contract." };

  const [project] = await db
    .select({
      id: projects.id,
      title: projects.title,
      collected: projects.collectedRevenue,
    })
    .from(projects)
    .where(eq(projects.id, contractId))
    .limit(1);
  if (!project) return { ok: false, message: "Contract not found." };

  // ── The guard. See the header. ──────────────────────────────
  const existing = await db
    .select({ id: buildVouchers.id })
    .from(buildVouchers)
    .where(eq(buildVouchers.sourceRefId, contractId))
    .limit(1);
  if (existing.length > 0) {
    return {
      ok: false,
      message:
        "This contract already has $BUILD against it. Issuing again would double it.",
    };
  }

  const splits = await db
    .select({
      recipientId: revenueSplits.recipientId,
      pool: revenueSplits.pool,
      amount: revenueSplits.amount,
    })
    .from(revenueSplits)
    .where(eq(revenueSplits.contractId, contractId));

  if (splits.length === 0) {
    return {
      ok: false,
      message:
        "This contract has not been settled, so there is nothing to base the cascade on.",
    };
  }

  const gross = Number(project.collected ?? 0);
  if (!Number.isFinite(gross) || gross <= 0) {
    return {
      ok: false,
      message: "No collected revenue recorded, so the cascade has no basis.",
    };
  }

  const contributors = splits.filter((s) => s.pool === "contributor");
  const admins = splits.filter((s) => s.pool === "admin");

  try {
    await issueBuildFromSettlement({
      gross,
      cashSourceKind: "contract_settlement",
      sourceId: contractId,
      contributors: {
        userIds: contributors.map((s) => s.recipientId),
        // Strings, matching the issuer's signature. numeric() comes
        // back as a string from node-postgres and the proportionate
        // split parses it itself; converting here and back would
        // round-trip through a float for no reason. See #94.
        amounts: contributors.map((s) => String(s.amount)),
      },
      admins: { userIds: admins.map((s) => s.recipientId) },
      actorUserId: admin.id,
      noteContext: `$BUILD generation — ${project.title} settlement (issued later)`,
    });
  } catch (err) {
    // Surfaced this time, rather than logged and forgotten. That
    // silence is the reason this action had to exist.
    // eslint-disable-next-line no-console
    console.error("[voucher-backfill] failed", err);
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Could not issue: ${err.message}`
          : "Could not issue the $BUILD. Nothing was written.",
    };
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "voucher.issued_from_settlement",
    resourceKind: "project",
    resourceId: contractId,
    before: { vouchers: 0 },
    after: {
      gross,
      contributors: contributors.length,
      admins: admins.length,
    },
    reason: `$BUILD issued after the fact for ${project.title}. The cascade did not run at settlement.`,
  });

  revalidatePath(`/admin/contracts/${contractId}`);
  revalidatePath(`/admin/contracts/${contractId}/ledger`);
  revalidatePath("/admin/contracts");

  return {
    ok: true,
    message: `$BUILD issued across ${contributors.length + admins.length} recipients plus the house pools.`,
  };
}
