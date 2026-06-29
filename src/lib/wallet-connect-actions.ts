/**
 * Wallet connect / disconnect server actions.
 *
 * Sandbox flow:
 *   - Client-side connector probes window.ethereum (MetaMask /
 *     Coinbase Wallet) or WalletConnect, runs `eth_requestAccounts`, and
 *     POSTs the chosen EOA + provider label here.
 *   - We verify it looks like an EVM address (basic regex) and persist
 *     onto the User row. No signature verification at this stage — the
 *     button is informational only and does not gate any privileged
 *     action.
 *
 * Production swap:
 *   - Replace the address-only persistence with a SIWE (EIP-4361) round
 *     trip:
 *       1. Server issues a nonce + statement.
 *       2. Client signs via `personal_sign`.
 *       3. Server verifies the signature, confirms the recovered address
 *          matches the claimed address, then writes `connected_wallet_*`
 *          on the User row and writes an audit log entry.
 *   - Production also supports multiple connected wallets per user; the
 *     sandbox keeps a single primary slot for now.
 *   - Use wagmi + RainbowKit on the client to handle the connector
 *     selection cleanly; the server contract here doesn't change.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

const ALLOWED_PROVIDERS = new Set([
  "metamask",
  "coinbase_wallet",
  "walletconnect",
  "rainbow",
  "trust_wallet",
  "phantom_evm",
  "brave",
  "injected",
  "other",
]);

function normalizeProvider(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "").toLowerCase();
  return ALLOWED_PROVIDERS.has(v) ? v : "other";
}

export async function connectWallet(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  const address = String(formData.get("address") ?? "").trim();
  if (!EVM_ADDRESS.test(address)) {
    throw new Error(
      "Invalid wallet address. Expected a 0x-prefixed 40-character hex string.",
    );
  }

  const target = MOCK_USERS.find((u) => u.id === user.id);
  if (!target) throw new Error("User not found");

  target.connectedWalletAddress = address;
  target.connectedWalletProvider = normalizeProvider(formData.get("provider"));
  target.walletConnectedAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();

  revalidatePath("/wallet");
  revalidatePath("/profile");
}

export async function disconnectWallet() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  const target = MOCK_USERS.find((u) => u.id === user.id);
  if (!target) throw new Error("User not found");

  target.connectedWalletAddress = null;
  target.connectedWalletProvider = null;
  target.walletConnectedAt = null;
  target.updatedAt = new Date().toISOString();

  revalidatePath("/wallet");
  revalidatePath("/profile");
}
