"use client";

/**
 * Establishes the httpOnly wallet session for Privy-authenticated users.
 * Mirrors WalletSessionBootstrap but uses the Privy embedded wallet provider.
 */

import { useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
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

  return null;
}
