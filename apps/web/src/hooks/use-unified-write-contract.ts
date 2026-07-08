"use client";

import { useAccount, useWriteContract } from "wagmi";
import { createWalletClient, custom, type Abi, type EIP1193Provider } from "viem";
import { celo } from "wagmi/chains";
import { getWeb3AuthProvider } from "@/lib/web3auth-bridge";
import { useState, useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useNoGas } from "@/contexts/no-gas-context";
import { isInsufficientGasError } from "@/lib/contract-error";

type WriteContractParams = {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
};

/**
 * Drop-in replacement for wagmi's useWriteContract that also supports
 * Web3Auth users via a direct viem wallet client.
 *
 * Returns the same shape as wagmi's useWriteContract:
 *   { writeContract, writeContractAsync, data, isPending, error, reset }
 */
export function useUnifiedWriteContract() {
  const {
    writeContractAsync: wagmiWriteAsync,
    isPending: wagmiIsPending,
    reset: wagmiReset,
  } = useWriteContract();
  const { isConnected: wagmiIsConnected } = useAccount();
  const { wallets: privyWallets } = useWallets();

  const { trigger: triggerNoGas } = useNoGas();

  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signDirect = useCallback(
    async (provider: EIP1193Provider, params: WriteContractParams) => {
      const walletClient = createWalletClient({
        chain: celo,
        transport: custom(provider),
      });
      const [account] = await walletClient.getAddresses();
      return walletClient.writeContract({
        ...(params as Parameters<typeof walletClient.writeContract>[0]),
        account,
        chain: celo,
      });
    },
    []
  );

  const writeContractAsync = useCallback(
    async (params: WriteContractParams): Promise<`0x${string}`> => {
      setError(null);
      const w3aProvider = getWeb3AuthProvider();

      if (w3aProvider) {
        setIsPending(true);
        try {
          const txHash = await signDirect(w3aProvider, params);
          setHash(txHash);
          return txHash;
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          setError(e);
          if (isInsufficientGasError(e)) triggerNoGas();
          throw e;
        } finally {
          setIsPending(false);
        }
      } else if (wagmiIsConnected) {
        setIsPending(true);
        try {
          const txHash = await wagmiWriteAsync({
            ...(params as Parameters<typeof wagmiWriteAsync>[0]),
            chainId: celo.id,
          });
          setHash(txHash);
          return txHash;
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          setError(e);
          if (isInsufficientGasError(e)) triggerNoGas();
          throw e;
        } finally {
          setIsPending(false);
        }
      } else {
        // No live wagmi connection and no bridged provider (e.g. a wallet
        // connected through Privy's own "wallet" login, which wagmi never
        // registers a connector for). Sign directly against that wallet's
        // EIP-1193 provider instead of handing off to wagmi's writeContract,
        // which throws inside @wagmi/core when there's no real connection.
        setIsPending(true);
        try {
          const privyProvider = (await privyWallets[0]
            ?.getEthereumProvider()
            .catch(() => null)) as EIP1193Provider | null;
          if (!privyProvider) {
            throw new Error("No wallet connected. Please reconnect your wallet and try again.");
          }
          const txHash = await signDirect(privyProvider, params);
          setHash(txHash);
          return txHash;
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          setError(e);
          if (isInsufficientGasError(e)) triggerNoGas();
          throw e;
        } finally {
          setIsPending(false);
        }
      }
    },
    [wagmiWriteAsync, wagmiIsConnected, privyWallets, signDirect, triggerNoGas]
  );

  const writeContract = useCallback(
    (params: WriteContractParams) => {
      writeContractAsync(params).catch(() => {});
    },
    [writeContractAsync]
  );

  const reset = useCallback(() => {
    setHash(undefined);
    setError(null);
    wagmiReset();
  }, [wagmiReset]);

  return {
    writeContract,
    writeContractAsync,
    data: hash,
    isPending: isPending || wagmiIsPending,
    error,
    reset,
  };
}
