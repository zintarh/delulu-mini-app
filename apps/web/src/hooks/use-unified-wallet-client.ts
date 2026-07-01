"use client";

import { useWalletClient } from "wagmi";
import { createWalletClient, custom } from "viem";
import type { EIP1193Provider } from "viem";
import { celo } from "wagmi/chains";
import { useEffect, useMemo, useState } from "react";
import { useWeb3Auth } from "@web3auth/modal/react";
import { useWallets } from "@privy-io/react-auth";

/**
 * Returns a viem WalletClient for whichever auth method is active:
 *   1. wagmi connector (injected/external wallet)
 *   2. Web3Auth EIP-1193 provider
 *   3. Privy embedded wallet EIP-1193 provider
 */
export function useUnifiedWalletClient() {
  const { data: wagmiWalletClient } = useWalletClient();
  const { provider: web3authProvider, isConnected: web3authConnected } =
    useWeb3Auth();
  const { wallets } = useWallets();

  const [web3authAddress, setWeb3authAddress] = useState<`0x${string}`>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [privyProvider, setPrivyProvider] = useState<any | null>(null);
  const [privyAddress, setPrivyAddress] = useState<`0x${string}` | undefined>();

  // Resolve Web3Auth address from its provider
  useEffect(() => {
    if (!web3authConnected || !web3authProvider) {
      setWeb3authAddress(undefined);
      return;
    }
    let isActive = true;
    (web3authProvider as unknown as EIP1193Provider)
      .request({ method: "eth_accounts" } as Parameters<EIP1193Provider["request"]>[0])
      .then((accounts) => {
        if (!isActive) return;
        setWeb3authAddress((accounts as string[])?.[0] as `0x${string}` | undefined);
      })
      .catch(() => {
        if (!isActive) return;
        setWeb3authAddress(undefined);
      });
    return () => {
      isActive = false;
    };
  }, [web3authConnected, web3authProvider]);

  // Resolve Privy embedded wallet provider
  const privyWallet = wallets.find(
    (w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2",
  );
  useEffect(() => {
    if (!privyWallet) {
      setPrivyProvider(null);
      setPrivyAddress(undefined);
      return;
    }
    let isActive = true;
    privyWallet
      .getEthereumProvider()
      .then((provider) => {
        if (!isActive) return;
        setPrivyProvider(provider);
        setPrivyAddress(privyWallet.address as `0x${string}`);
      })
      .catch(() => {
        if (!isActive) return;
        setPrivyProvider(null);
      });
    return () => {
      isActive = false;
    };
  }, [privyWallet?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  const web3authClient = useMemo(() => {
    if (wagmiWalletClient) return null;
    const w3aProvider = web3authConnected ? (web3authProvider as unknown as EIP1193Provider) : null;
    if (!w3aProvider || !web3authAddress) return null;
    return createWalletClient({
      account: { address: web3authAddress, type: "json-rpc" },
      chain: celo,
      transport: custom(w3aProvider),
    });
  }, [wagmiWalletClient, web3authProvider, web3authConnected, web3authAddress]);

  const privyClient = useMemo(() => {
    if (wagmiWalletClient || web3authClient) return null;
    if (!privyProvider || !privyAddress) return null;
    return createWalletClient({
      account: { address: privyAddress, type: "json-rpc" },
      chain: celo,
      transport: custom(privyProvider as unknown as EIP1193Provider),
    });
  }, [wagmiWalletClient, web3authClient, privyProvider, privyAddress]);

  return wagmiWalletClient ?? web3authClient ?? privyClient ?? null;
}
