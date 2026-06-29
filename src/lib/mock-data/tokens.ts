/**
 * Mock token transactions ledger.
 *
 * REPLACE WITH: `token_transactions` table queries, plus an on-chain
 * reader that reconciles multisig distributions with the local ledger.
 * The admin "Distribute $BUILD" UI in /admin/tokens should eventually
 * call a multisig-propose action; until then it writes here (stub).
 */
import type { TokenTransaction } from "@/lib/types";

export const MOCK_TRANSACTIONS: TokenTransaction[] = [
  {
    id: "tx_001",
    userId: "u_aliza",
    amount: "450.00000000",
    type: "project_completion",
    projectId: "p_004",
    description: "Artist profile series — delivered Feb 2026.",
    transactionHash: null, // not yet on chain in sandbox
    createdAt: "2026-02-16T00:00:00Z",
  },
  {
    id: "tx_002",
    userId: "u_michael",
    amount: "300.00000000",
    type: "project_completion",
    projectId: "p_003",
    description: "DCG GTM milestone 1.",
    transactionHash: null,
    createdAt: "2026-03-25T00:00:00Z",
  },
  {
    id: "tx_003",
    userId: "u_rob",
    amount: "150.00000000",
    type: "collaboration",
    projectId: "p_003",
    description: "Paired GTM delivery with u_michael.",
    transactionHash: null,
    createdAt: "2026-03-25T00:00:00Z",
  },
  {
    id: "tx_004",
    userId: "u_jamar",
    amount: "2000.00000000",
    type: "governance",
    projectId: null,
    description: "Q1 2026 governance allocation.",
    transactionHash: null,
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "tx_005",
    userId: "u_chibu",
    amount: "500.00000000",
    type: "referral",
    projectId: null,
    description: "Referred u_trevor as prospect.",
    transactionHash: null,
    createdAt: "2026-02-18T00:00:00Z",
  },
];
