"use client";

/**
 * Establishes the httpOnly wallet session for Privy-authenticated users
 * and wires the Privy EIP-1193 provider into the shared web3auth-bridge
 * so that useUnifiedWriteContract can sign transactions for Privy users
 * (wagmi has no Privy connector, so we reuse the same EIP-1193 path).
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

  useEffect(() => {
    if (!authenticated || wallets.length === 0) return;

    const privyWallet = wallets.find(
      (w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2",
    );
    if (!privyWallet) return;
    if (establishedRef.current === privyWallet.address) return;

    void (async () => {
      try {
        const ethProvider = await privyWallet.getEthereumProvider();

        // Wire the Privy provider into the same bridge Web3Auth uses.
        // useUnifiedWriteContract checks this first and signs directly via
        // viem — bypassing wagmi's connector (which Privy never registers).
        setWeb3AuthProvider(ethProvider as unknown as EIP1193Provider);

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

  // Clear the provider bridge when the user logs out
  useEffect(() => {
    if (!authenticated) {
      setWeb3AuthProvider(null);
      establishedRef.current = null;
    }
  }, [authenticated]);

  return null;
}
