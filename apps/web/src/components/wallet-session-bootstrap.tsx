"use client";

/**
 * Establishes the httpOnly wallet session once per Web3Auth connection.
 * Mounted once at the app root — never in useAuth() (50+ subscribers).
 */

import { useEffect, useRef } from "react";
import { useWeb3Auth } from "@web3auth/modal/react";
import { establishWalletSession } from "@/lib/auth/establish-wallet-session-client";

export function WalletSessionBootstrap() {
  const { isConnected, provider } = useWeb3Auth();
  const connectionEpochRef = useRef(0);
  const activeEpochRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isConnected) {
      activeEpochRef.current = null;
      return;
    }
    if (!provider) return;

    const epoch = ++connectionEpochRef.current;
    activeEpochRef.current = epoch;
    let cancelled = false;

    void (async () => {
      try {
        const accounts = (await provider.request({
          method: "eth_accounts",
          params: [],
        })) as string[] | undefined;
        const address = accounts?.[0];
        if (!address || cancelled || activeEpochRef.current !== epoch) return;

        await establishWalletSession(address, provider as {
          request: (args: { method: string; params: unknown[] }) => Promise<string>;
        });
      } catch (err) {
        if (!cancelled) {
          console.warn("[auth] wallet session bootstrap failed:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (activeEpochRef.current === epoch) {
        activeEpochRef.current = null;
      }
    };
  }, [isConnected, provider]);

  return null;
}
