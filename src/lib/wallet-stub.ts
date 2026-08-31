/**
 * ============================================================
 * STUB — fake wallet / token layer for the sandbox prototype.
 *
 * REPLACE WITH:
 *   - viem / wagmi for client-side wallet read & connect
 *   - server-side multisig integration (Safe SDK or similar)
 *     for actual on-chain $BUILD distributions
 *   - ERC-6551 helpers to derive token-bound account addresses
 *     from member identity
 *
 * Off-chain behavior (2026-08-30):
 *   - Reads `buildTokenBalance` and `walletAddress` from the users
 *     table.
 *   - "Distribute $BUILD" writes a TokenTransaction row and bumps the
 *     recipient's balance in the same transaction, and issues the
 *     matching voucher first.
 *
 * Previously all three of those were in-memory, so an admin
 * distribution showed a success state, moved a balance that reset on
 * the next deploy, and left no ledger row behind.
 *
 * The shape of `distributeBuild()` matches what a real multisig
 * `proposeTransaction()` call would look like — params first,
 * then a callable that the admin UI awaits. Swap implementations
 * without touching the admin UI.
 * ============================================================
 */
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { tokenTransactions, users } from "@/db/schema";
import { getUserById } from "@/lib/readers/users";
import { getTokensForUser } from "@/lib/readers";
import { issueVoucherInternal } from "@/lib/voucher-issuance";
import type {
  BuildVoucherSourceType,
  TokenTransaction,
} from "@/lib/types";

export async function getBalance(userId: string): Promise<string> {
  const u = await getUserById(userId);
  return u?.buildTokenBalance ?? "0.00000000";
}

export async function getTransactions(
  userId: string,
): Promise<TokenTransaction[]> {
  const rows = await getTokensForUser(userId);
  return [...rows].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export interface DistributeBuildParams {
  toUserId: string;
  amount: string; // decimal string, like "100.00000000"
  type: TokenTransaction["type"];
  projectId?: string | null;
  description?: string | null;
  /**
   * Actor id for the audit trail on the cascaded voucher. Null = system-
   * initiated (e.g., automated bonus release with no explicit admin
   * clicking a button). The token-transaction log itself doesn't track
   * actor today, but the voucher does — every voucher answers
   * "who authorized this issuance."
   */
  initiatedByUserId?: string | null;
}

/**
 * Sandbox: appends to MOCK_TRANSACTIONS + mutates the user's balance
 * + issues a matching BuildVoucher via the shared voucher-issuance
 * helper. Every earning path (manual admin distribution, bonus
 * release cascade, order-split settlement, future project-completion
 * event handlers) flows through here, so voucher issuance stays in
 * lockstep with $BUILD movement.
 *
 * Supply-cap enforcement lives inside issueVoucherInternal — if the
 * distribution would push above the 10M voucher cap, it throws BEFORE
 * the ledger row or the balance move, so the whole distribution is
 * all-or-nothing. Callers get a clear error rather than a silent
 * over-issuance.
 *
 * Production: this becomes a Safe multisig propose -> sign ->
 * execute flow, and the voucher issuance still fires alongside
 * (voucher is the off-chain accounting mirror; both must move
 * together).
 */
export async function distributeBuild(
  params: DistributeBuildParams,
): Promise<TokenTransaction> {
  // Real lookup. The fixture scan here threw "Unknown recipient" for
  // anyone who signed up through the live flow, which made every
  // distribution to a real member impossible.
  const recipient = await getUserById(params.toUserId);
  if (!recipient) throw new Error(`Unknown recipient: ${params.toUserId}`);

  const tx: TokenTransaction = {
    id: `tx_${randomUUID()}`,
    userId: params.toUserId,
    amount: params.amount,
    type: params.type,
    projectId: params.projectId ?? null,
    description: params.description ?? null,
    transactionHash: null, // sandbox has no chain
    compStage: null,
    withholdReason: null,
    createdAt: new Date().toISOString(),
  };

  // Fire voucher issuance FIRST so supply-cap failure surfaces
  // before we mutate the transaction log or the recipient balance.
  // The TokenTransaction type maps 1:1 to BuildVoucherSourceType
  // (both are the same enum — project_completion / referral /
  // collaboration / governance / admin_grant).
  await issueVoucherInternal({
    userId: params.toUserId,
    amount: params.amount,
    sourceType: params.type as BuildVoucherSourceType,
    sourceRefId: tx.id,
    notes:
      params.description ??
      `Auto-issued alongside ${params.type.replace(/_/g, " ")} distribution.`,
    issuedByUserId: params.initiatedByUserId ?? null,
  });

  // Ledger row and balance move together. A distribution recorded
  // without the balance change, or the reverse, is not detectable
  // afterwards — there is no third source to reconcile against.
  //
  // The increment is computed in SQL rather than read-then-write, so
  // two distributions to the same member cannot both read the same
  // starting balance and one overwrite the other.
  await db.transaction(async (dbTx) => {
    await dbTx.insert(tokenTransactions).values({
      id: tx.id,
      userId: tx.userId,
      amount: tx.amount,
      type: tx.type,
      projectId: tx.projectId,
      description: tx.description,
      transactionHash: tx.transactionHash,
      compStage: tx.compStage,
      withholdReason: tx.withholdReason,
      createdAt: tx.createdAt,
    });

    await dbTx
      .update(users)
      .set({
        buildTokenBalance: sql`COALESCE(${users.buildTokenBalance}, 0) + ${params.amount}::numeric`,
      })
      .where(eq(users.id, params.toUserId));
  });

  return tx;
}
