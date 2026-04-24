"use client";

import { useWalletClient } from "wagmi";
import { createWalletClient, custom } from "viem";
import { celo } from "wagmi/chains";
import { useEffect, useMemo, useState } from "react";
import { useWeb3Auth } from "@web3auth/modal/react";

/**
 * Returns a viem WalletClient for both Privy (wagmi) and Web3Auth users.
 * Privy users get the wagmi-managed wallet client.
 * Web3Auth users get a viem client built from the Web3Auth EIP-1193 provider.
 */
export function useUnifiedWalletClient() {
  const { data: wagmiWalletClient } = useWalletClient();
  const { provider: web3authProvider, isConnected: web3authConnected } =
    useWeb3Auth();
  const [web3authAddress, setWeb3authAddress] = useState<`0x${string}`>();

  useEffect(() => {
    if (!web3authConnected || !web3authProvider) {
      setWeb3authAddress(undefined);
      return;
    }

    let isActive = true;
    (web3authProvider as any)
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (!isActive) return;
        setWeb3authAddress(accounts?.[0] as `0x${string}` | undefined);
      })
      .catch(() => {
        if (!isActive) return;
        setWeb3authAddress(undefined);
      });

    return () => {
      isActive = false;
    };
  }, [web3authConnected, web3authProvider]);

  const web3authClient = useMemo(() => {
    if (wagmiWalletClient) return null;
    const w3aProvider = web3authConnected ? (web3authProvider as any) : null;
    if (!w3aProvider || !web3authAddress) return null;
    return createWalletClient({
      account: { address: web3authAddress, type: "json-rpc" },
      chain: celo,
      transport: custom(w3aProvider),
    });
  }, [wagmiWalletClient, web3authProvider, web3authConnected, web3authAddress]);

  return wagmiWalletClient ?? web3authClient ?? null;
}
