"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { deluluAbi } from "@/lib/contracts/delulu-abi";
import { CONTRACTS, type Delusion, type UserStake } from "@/lib/contracts/config";
import type { Address } from "viem";

/**
 * Get the Delulu contract address for the current chain
 */
export function useDeluluContractAddress() {
  const chainId = useChainId();
  return CONTRACTS.delulu[chainId as keyof typeof CONTRACTS.delulu] || CONTRACTS.delulu[44787]; // Default to Alfajores
}

/**
 * Get the cUSD token address for the current chain
 */
export function useCUSDContractAddress() {
  const chainId = useChainId();
  return CONTRACTS.cUSD[chainId as keyof typeof CONTRACTS.cUSD] || CONTRACTS.cUSD[44787]; // Default to Alfajores
}

// ============ Write Functions (Transactions) ============

/**
 * Hook to create a new delusion
 * @param onSuccess - Callback function when transaction is successful
 */
export function useCreateDelusion(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createDelusion = (
    deluluText: string,
    deadline: bigint,
    amount: bigint,
    position: boolean // true = Believe, false = Doubt
  ) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "createDelusion",
      args: [deluluText, deadline, amount, position],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    createDelusion,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to stake believing the delusion will succeed
 */
export function useStakeBelieve(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const stakeBelieve = (delusionId: bigint, amount: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "stakeBelieve",
      args: [delusionId, amount],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    stakeBelieve,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to stake doubting the delusion will succeed
 */
export function useStakeDoubt(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const stakeDoubt = (delusionId: bigint, amount: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "stakeDoubt",
      args: [delusionId, amount],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    stakeDoubt,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to switch from Doubt to Believe position
 */
export function useSwitchToBelieve(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const switchToBelieve = (delusionId: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "switchToBelieve",
      args: [delusionId],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    switchToBelieve,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to switch from Believe to Doubt position
 */
export function useSwitchToDoubt(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const switchToDoubt = (delusionId: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "switchToDoubt",
      args: [delusionId],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    switchToDoubt,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to withdraw stake before deadline (with penalty)
 */
export function useWithdrawStake(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawStake = (delusionId: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "withdrawStake",
      args: [delusionId],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    withdrawStake,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to finalize delusion as successful (believers win)
 * Only creator can call this
 */
export function useFinalizeDelusionSuccess(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const finalizeSuccess = (delusionId: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "finalizeDelusionSuccess",
      args: [delusionId],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    finalizeSuccess,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to finalize delusion as failed (doubters win)
 * Only creator can call this
 */
export function useFinalizeDelusionFail(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const finalizeFail = (delusionId: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "finalizeDelusionFail",
      args: [delusionId],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    finalizeFail,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to claim rewards after delusion is finalized
 */
export function useClaimReward(onSuccess?: (data: any) => void) {
  const address = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claim = (delusionId: bigint) => {
    writeContract({
      address,
      abi: deluluAbi,
      functionName: "claim",
      args: [delusionId],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    claim,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

// ============ Read Functions (View/Pure) ============

/**
 * Hook to get delusion details by ID
 */
export function useGetDelusion(delusionId: bigint | undefined) {
  const address = useDeluluContractAddress();
  
  const { data, error, isLoading, refetch } = useReadContract({
    address,
    abi: deluluAbi,
    functionName: "getDelusion",
    args: delusionId !== undefined ? [delusionId] : undefined,
    query: {
      enabled: delusionId !== undefined && delusionId > 0n,
    },
  });

  return {
    delusion: data as Delusion | undefined,
    error,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get user's stake in a delusion
 */
export function useGetUserStake(delusionId: bigint | undefined, userAddress: Address | undefined) {
  const address = useDeluluContractAddress();
  
  const { data, error, isLoading, refetch } = useReadContract({
    address,
    abi: deluluAbi,
    functionName: "getUserStake",
    args: delusionId !== undefined && userAddress ? [delusionId, userAddress] : undefined,
    query: {
      enabled: delusionId !== undefined && delusionId > 0n && !!userAddress,
    },
  });

  return {
    userStake: data as UserStake | undefined,
    error,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get pool amounts for a delusion
 */
export function useGetPools(delusionId: bigint | undefined) {
  const address = useDeluluContractAddress();
  
  const { data, error, isLoading, refetch } = useReadContract({
    address,
    abi: deluluAbi,
    functionName: "getPools",
    args: delusionId !== undefined ? [delusionId] : undefined,
    query: {
      enabled: delusionId !== undefined && delusionId > 0n,
    },
  });

  return {
    pools: data ? { believePool: data[0], doubtPool: data[1] } : undefined,
    error,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get total delusion counter
 */
export function useGetDelusionCounter() {
  const address = useDeluluContractAddress();
  
  const { data, error, isLoading, refetch } = useReadContract({
    address,
    abi: deluluAbi,
    functionName: "delusionCounter",
  });

  return {
    counter: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  };
}

