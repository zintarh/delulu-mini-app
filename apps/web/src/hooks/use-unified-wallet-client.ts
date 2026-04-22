"use client";

import { useWalletClient } from "wagmi";
import { createWalletClient, custom } from "viem";
import { celo } from "wagmi/chains";
import { getWeb3AuthProvider } from "@/lib/web3auth-bridge";
import { useMemo } from "react";

/**
 * Returns a viem WalletClient for both Privy (wagmi) and Web3Auth users.
 * Privy users get the wagmi-managed wallet client.
 * Web3Auth users get a viem client built from the Web3Auth EIP-1193 provider.
 */
export function useUnifiedWalletClient() {
  const { data: wagmiWalletClient } = useWalletClient();

  const web3authClient = useMemo(() => {
    if (wagmiWalletClient) return null;
    const w3aProvider = getWeb3AuthProvider();
    if (!w3aProvider) return null;
    return createWalletClient({ chain: celo, transport: custom(w3aProvider) });
  }, [wagmiWalletClient]);

  return wagmiWalletClient ?? web3authClient ?? null;
}
