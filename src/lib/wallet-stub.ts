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
 * Sandbox behavior:
 *   - Reads `buildTokenBalance` and `walletAddress` from MOCK_USERS.
 *   - "Distribute $BUILD" admin action appends a synthetic
 *     TokenTransaction to the in-memory ledger and bumps the
 *     recipient's balance. Resets when the dev server restarts.
 *
 * The shape of `distributeBuild()` matches what a real multisig
 * `proposeTransaction()` call would look like — params first,
 * then a callable that the admin UI awaits. Swap implementations
 * without touching the admin UI.
 * ============================================================
 */
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data/tokens";
import { issueVoucherInternal } from "@/lib/voucher-issuance";
import type {
  BuildVoucherSourceType,
  TokenTransaction,
} from "@/lib/types";

export function getBalance(userId: string): string {
  const u = MOCK_USERS.find((x) => x.id === userId);
  return u?.buildTokenBalance ?? "0.00000000";
}

export function getTransactions(userId: string): TokenTransaction[] {
  return MOCK_TRANSACTIONS.filter((tx) => tx.userId === userId).sort(
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
 * distribution would push above the 10M voucher cap, it throws
 * BEFORE mutating MOCK_TRANSACTIONS or the recipient balance, so
 * the whole distribution is transactional. Callers get a clear
 * error rather than a silent over-issuance.
 *
 * Production: this becomes a Safe multisig propose -> sign ->
 * execute flow, and the voucher issuance still fires alongside
 * (voucher is the off-chain accounting mirror; both must move
 * together).
 */
export function distributeBuild(params: DistributeBuildParams): TokenTransaction {
  const recipient = MOCK_USERS.find((u) => u.id === params.toUserId);
  if (!recipient) throw new Error(`Unknown recipient: ${params.toUserId}`);

  const tx: TokenTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
  issueVoucherInternal({
    userId: params.toUserId,
    amount: params.amount,
    sourceType: params.type as BuildVoucherSourceType,
    sourceRefId: tx.id,
    notes:
      params.description ??
      `Auto-issued alongside ${params.type.replace(/_/g, " ")} distribution.`,
    issuedByUserId: params.initiatedByUserId ?? null,
  });

  MOCK_TRANSACTIONS.push(tx);
  // Balance mutation — fine for in-memory sandbox; real implementation
  // would be a chain-side balance read after settlement.
  const next = (Number(recipient.buildTokenBalance) + Number(params.amount)).toFixed(8);
  recipient.buildTokenBalance = next;

  return tx;
}
