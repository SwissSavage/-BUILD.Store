"use client";

/**
 * Wallet connect card.
 *
 * Client-side connector that probes `window.ethereum` for an injected
 * EVM provider (MetaMask, Coinbase Wallet, Brave, Rainbow, Trust). If
 * none is present, we surface the WalletConnect deep-link path as a
 * future-swap pointer. On a successful `eth_requestAccounts`, we POST
 * the address + provider label to `connectWallet` server action via a
 * native form submit so the request still works progressively.
 *
 * Sandbox semantics:
 *   - The button is informational. We persist the address on the User
 *     row but don't yet require a signature.
 *   - Production swaps this for the SIWE flow described in
 *     `lib/wallet-connect-actions.ts`. The component contract stays
 *     identical: form submit POSTs `address` + `provider` + (in prod)
 *     `signature` + `nonce`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { connectWallet, disconnectWallet } from "@/lib/wallet-connect-actions";

type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isRainbow?: boolean;
  isTrust?: boolean;
};

type WindowWithEthereum = Window & { ethereum?: InjectedProvider };

function detectProviderLabel(p: InjectedProvider | undefined): string {
  if (!p) return "other";
  if (p.isMetaMask) return "metamask";
  if (p.isCoinbaseWallet) return "coinbase_wallet";
  if (p.isBraveWallet) return "brave";
  if (p.isRainbow) return "rainbow";
  if (p.isTrust) return "trust_wallet";
  return "injected";
}

export function WalletConnectCard({
  connectedAddress,
  connectedProvider,
  connectedAt,
}: {
  connectedAddress: string | null;
  connectedProvider: string | null;
  connectedAt: string | null;
}) {
  const [hasInjected, setHasInjected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const providerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as WindowWithEthereum;
    setHasInjected(typeof w.ethereum?.request === "function");
  }, []);

  const handleConnect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const w = window as WindowWithEthereum;
      const provider = w.ethereum;
      if (!provider || typeof provider.request !== "function") {
        throw new Error(
          "No injected wallet found. Install MetaMask, Coinbase Wallet, or another EVM wallet.",
        );
      }
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("No account returned by the wallet.");

      if (addressInputRef.current) addressInputRef.current.value = address;
      if (providerInputRef.current) {
        providerInputRef.current.value = detectProviderLabel(provider);
      }
      formRef.current?.requestSubmit();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const short = (addr: string | null): string =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <div className="text-xs uppercase tracking-wider text-brand-magenta">
        External wallet
      </div>
      <h2 className="mt-1 font-display text-xl font-semibold">
        Connected wallet
      </h2>

      {connectedAddress ? (
        <div className="mt-4 space-y-2 text-sm">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-faint">
              Address
            </span>
            <div className="mt-1 break-all font-mono">{connectedAddress}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <span>
              Provider: <strong className="capitalize">{connectedProvider ?? "n/a"}</strong>
            </span>
            {connectedAt && (
              <span>
                Connected {new Date(connectedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConnect}
              disabled={!hasInjected || connecting}
              className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta disabled:opacity-50"
            >
              {connecting ? "Reconnecting…" : "Reconnect / switch"}
            </button>
            <form action={disconnectWallet}>
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "#D828A0" }}
              >
                Disconnect
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-ink-muted">
            Connect MetaMask, Coinbase Wallet, Rainbow, Brave, or any
            injected EVM wallet. We persist the address only. Production
            swap upgrades this to a Sign-In With Ethereum (SIWE)
            signature round trip.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#5070F0" }}
          >
            {connecting
              ? "Connecting…"
              : hasInjected
                ? "Connect wallet"
                : "Install a wallet to connect"}
          </button>
          {!hasInjected && (
            <p className="text-[11px] text-ink-faint">
              WalletConnect deep-link path lands in the production swap
              (RainbowKit / Web3Modal). For now the sandbox only sees
              injected providers like MetaMask.
            </p>
          )}
          {error && (
            <p className="text-[11px] text-brand-magenta">{error}</p>
          )}
        </div>
      )}

      {/* Hidden form posted by the connect handler. */}
      <form
        ref={formRef}
        action={connectWallet}
        className="hidden"
        aria-hidden
      >
        <input ref={addressInputRef} type="hidden" name="address" />
        <input ref={providerInputRef} type="hidden" name="provider" />
      </form>

      <p className="mt-4 text-[11px] text-ink-faint">
        Short: {short(connectedAddress)}
      </p>
    </div>
  );
}
