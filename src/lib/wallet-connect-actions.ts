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
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";

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

  // Was MOCK_USERS.find, which returns undefined for anyone who signed
  // up through Auth.js, so this threw "User not found" for every real
  // member before it reached the assignments below. The assignments then
  // wrote to a fixture object nothing reads. Connecting a wallet has
  // never worked outside seed accounts.
  //
  // getCurrentUser already carries the id, so the lookup was redundant
  // as well as wrong: update by id and let the row count report whether
  // the member exists.
  const now = new Date().toISOString();
  const connected = await db
    .update(users)
    .set({
      connectedWalletAddress: address,
      connectedWalletProvider: normalizeProvider(formData.get("provider")),
      walletConnectedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, user.id))
    .returning({ id: users.id });
  if (connected.length === 0) {
    throw new Error("Could not save the wallet. The account was not found.");
  }

  revalidatePath("/wallet");
  revalidatePath("/profile");
}

export async function disconnectWallet() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  // Disconnect is not guarded on a wallet being present: clearing an
  // already-clear row is the same end state, and a member who clicks
  // twice should not see an error.
  const cleared = await db
    .update(users)
    .set({
      connectedWalletAddress: null,
      connectedWalletProvider: null,
      walletConnectedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, user.id))
    .returning({ id: users.id });
  if (cleared.length === 0) {
    throw new Error("Could not disconnect the wallet. The account was not found.");
  }

  revalidatePath("/wallet");
  revalidatePath("/profile");
}
