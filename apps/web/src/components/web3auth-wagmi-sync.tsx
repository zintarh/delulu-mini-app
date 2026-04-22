"use client";

/**
 * Listens for Web3Auth login events and syncs the EIP-1193 provider into
 * the wagmi connector so that `useAccount()` reflects the Web3Auth wallet.
 */

import { useEffect } from "react";
import { useConnect } from "wagmi";
import { useWeb3Auth } from "@web3auth/modal/react";
import { type EIP1193Provider } from "viem";
import { setWeb3AuthProvider } from "@/lib/web3auth-bridge";

export function Web3AuthWagmiSync() {
  const { provider, isConnected: web3authConnected } = useWeb3Auth();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    if (!web3authConnected || !provider) return;

    setWeb3AuthProvider(provider as unknown as EIP1193Provider);

    const connector = connectors.find((c) => c.id === "web3auth");
    if (connector) {
      connect({ connector });
    }
  }, [web3authConnected, provider, connect, connectors]);

  useEffect(() => {
    if (!web3authConnected) {
      setWeb3AuthProvider(null);
    }
  }, [web3authConnected]);

  return null;
}
