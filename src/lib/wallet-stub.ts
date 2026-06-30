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
import type { TokenTransaction } from "@/lib/types";

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
}

/**
 * Sandbox: appends to MOCK_TRANSACTIONS + mutates the user's balance.
 * Production: this becomes a Safe multisig propose -> sign -> execute flow.
 */
export function distributeBuild(params: DistributeBuildParams): TokenTransaction {
  const recipient = MOCK_USERS.find((u) => u.id === params.toUserId);
  if (!recipient) throw new Error(`Unknown recipient: ${params.toUserId}`);

  const tx: TokenTransaction = {
    id: `tx_${Date.now()}`,
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

  MOCK_TRANSACTIONS.push(tx);
  // Balance mutation — fine for in-memory sandbox; real implementation
  // would be a chain-side balance read after settlement.
  const next = (Number(recipient.buildTokenBalance) + Number(params.amount)).toFixed(8);
  recipient.buildTokenBalance = next;

  return tx;
}
