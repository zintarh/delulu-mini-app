"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { deluluAbi } from "@/lib/contracts/delulu-abi";
import { DELULU_CONTRACT_ADDRESS, CUSD_CONTRACT_ADDRESS, type Delusion, type UserStake } from "@/lib/contracts/config";
import type { Address } from "viem";



// ============ Write Functions (Transactions) ============

/**
 * Hook to create a new delusion
 * @param onSuccess - Callback function when transaction is successful
 */
export function useCreateDelusion(onSuccess?: (data: any) => void) {
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
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const stakeBelieve = (delusionId: bigint, amount: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const stakeDoubt = (delusionId: bigint, amount: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const switchToBelieve = (delusionId: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const switchToDoubt = (delusionId: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawStake = (delusionId: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const finalizeSuccess = (delusionId: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const finalizeFail = (delusionId: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claim = (delusionId: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
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
  
  const { data, error, isLoading, refetch } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: deluluAbi,
    functionName: "getDelusion",
    args: delusionId !== undefined ? [delusionId] : undefined,
    query: {
      enabled: delusionId !== undefined && delusionId > BigInt(0),
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
  
  const { data, error, isLoading, refetch } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: deluluAbi,
    functionName: "getUserStake",
    args: delusionId !== undefined && userAddress ? [delusionId, userAddress] : undefined,
    query: {
      enabled: delusionId !== undefined && delusionId > BigInt(0) && !!userAddress,
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
  
  const { data, error, isLoading, refetch } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: deluluAbi,
    functionName: "getPools",
    args: delusionId !== undefined ? [delusionId] : undefined,
    query: {
      enabled: delusionId !== undefined && delusionId > 0,
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
  
  const { data, error, isLoading, refetch } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
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

