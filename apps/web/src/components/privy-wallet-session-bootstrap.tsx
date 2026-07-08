"use client";

/**
 * Establishes the httpOnly wallet session for Privy-authenticated users
 * and wires the Privy EIP-1193 provider into the shared web3auth-bridge
 * so that useUnifiedWriteContract can sign transactions for Privy users
 * (wagmi has no Privy connector — for embedded *or* externally-connected
 * wallets — so we reuse the same EIP-1193 path for all of them).
 */

import { useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { EIP1193Provider } from "viem";
import { setWeb3AuthProvider } from "@/lib/web3auth-bridge";
import { establishWalletSession } from "@/lib/auth/establish-wallet-session-client";

export function PrivyWalletSessionBootstrap() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const establishedRef = useRef<string | null>(null);
  // Track whether this component was the one that set the bridge provider
  // so the cleanup only clears what Privy set — not what Web3Auth may have set.
  const didSetProviderRef = useRef(false);

  useEffect(() => {
    if (!authenticated || wallets.length === 0) return;

    // Any Privy-connected wallet — embedded ("privy"/"privy-v2") or an
    // externally-connected one (MetaMask, WalletConnect, etc. via Privy's
    // "wallet" login method) — needs this bridge, since wagmi never
    // registers a connector for wallets connected through Privy.
    const privyWallet = wallets[0];
    if (!privyWallet) return;
    if (establishedRef.current === privyWallet.address) return;

    void (async () => {
      try {
        const ethProvider = await privyWallet.getEthereumProvider();

        // Wire the Privy provider into the same bridge Web3Auth uses.
        // useUnifiedWriteContract checks this first and signs directly via
        // viem — bypassing wagmi's connector (which Privy never registers).
        setWeb3AuthProvider(ethProvider as unknown as EIP1193Provider);
        didSetProviderRef.current = true;

        const ok = await establishWalletSession(privyWallet.address, {
          request: (args: { method: string; params: unknown[] }) =>
            ethProvider.request(args) as Promise<string>,
        });
        if (ok) establishedRef.current = privyWallet.address;
      } catch (err) {
        console.warn("[auth] privy wallet session bootstrap failed:", err);
      }
    })();
  }, [authenticated, wallets]);

  // Only clear the bridge when Privy logs out AND Privy was the one who set it.
  // Avoids clobbering the Web3Auth provider for Web3Auth users.
  useEffect(() => {
    if (!authenticated && didSetProviderRef.current) {
      setWeb3AuthProvider(null);
      didSetProviderRef.current = false;
      establishedRef.current = null;
    }
  }, [authenticated]);

  return null;
}
