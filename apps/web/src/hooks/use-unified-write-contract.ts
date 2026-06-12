"use client";

import { useWriteContract } from "wagmi";
import { createWalletClient, custom, type Abi } from "viem";
import { celo } from "wagmi/chains";
import { getWeb3AuthProvider } from "@/lib/web3auth-bridge";
import { useState, useCallback } from "react";
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

  const { trigger: triggerNoGas } = useNoGas();

  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const writeContractAsync = useCallback(
    async (params: WriteContractParams): Promise<`0x${string}`> => {
      setError(null);
      const w3aProvider = getWeb3AuthProvider();

      if (w3aProvider) {
        setIsPending(true);
        try {
          const walletClient = createWalletClient({
            chain: celo,
            transport: custom(w3aProvider),
          });
          const [account] = await walletClient.getAddresses();
          const txHash = await walletClient.writeContract({
            ...(params as Parameters<typeof walletClient.writeContract>[0]),
            account,
            chain: celo,
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
      }
    },
    [wagmiWriteAsync]
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
