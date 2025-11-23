"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { deluluAbi } from "@/lib/contracts/delulu-abi";
import {
  DELULU_CONTRACT_ADDRESS,
  type Delusion,
  type UserStake,
  DelusionStatus,
  StakePosition,
} from "@/lib/contracts/config";
import type { Address } from "viem";

/**
 * Hook to create a new delusion
 * @param onSuccess - Callback function when transaction is successful
 */
export function useCreateDelusion(onSuccess?: (data: any) => void) {
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
    status: receiptStatus,
  } = useWaitForTransactionReceipt({
    hash,
    pollingInterval: 2000, // Poll every 2 seconds instead of default
    retryCount: 10, // Retry up to 10 times
    timeout: 60000, // Wait up to 60 seconds
  });

  // Log receipt polling status
  console.log("📊 Transaction receipt status:", {
    hash,
    isConfirming,
    isSuccess,
    receiptStatus,
    receiptError: receiptError?.message,
  });

  const createDelusion = (
    description: string,
    durationInSeconds: bigint,
    stakeAmount: bigint
  ) => {
    try {
      console.log("🔄 useCreateDelusion - calling writeContract with:", {
        address: DELULU_CONTRACT_ADDRESS,
        description,
        durationInSeconds: durationInSeconds.toString(),
        stakeAmount: stakeAmount.toString(),
      });

      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: deluluAbi,
        functionName: "createDelusion",
        args: [description, durationInSeconds, stakeAmount],
      });

      console.log("✅ writeContract called successfully");
    } catch (err) {
      console.error("❌ Error in createDelusion:", err);
      throw err;
    }
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  const combinedError = receiptError || error;

  return {
    createDelusion,
    hash,
    error: combinedError,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    receiptStatus,
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


export function useWithdrawStake(onSuccess?: (data: any) => void) {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const withdrawStake = (delusionId: bigint) => {
   
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
 * Hook to claim winnings after delusion is verified
 */
export function useClaimWinnings(onSuccess?: (data: any) => void) {
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimWinnings = (delusionId: bigint) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: deluluAbi,
      functionName: "claimWinnings",
      args: [delusionId],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    claimWinnings,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Hook to verify delusion (creator only, after deadline)
 */
export function useVerifyDelusion(onSuccess?: (data: any) => void) {
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const verifyDelusion = (delusionId: bigint, result: boolean) => {
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: deluluAbi,
      functionName: "verifyDelusion",
      args: [delusionId, result],
    });
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    verifyDelusion,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

// Keeping old function names for backward compatibility but they now call verify
export const useFinalizeDelusionSuccess = useVerifyDelusion;
export const useFinalizeDelusionFail = useVerifyDelusion;
export const useClaimReward = useClaimWinnings;

// ============ Read Functions (View/Pure) ============

/**
 * Hook to get delusion details by ID
 */
export function useGetDelusion(delusionId: bigint | undefined) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: deluluAbi,
    functionName: "delusions", // Use the public mapping instead
    args: delusionId !== undefined ? [delusionId] : undefined,
    query: {
      enabled: delusionId !== undefined && delusionId > BigInt(0),
    },
  });

  console.log("useGetDelusion hook (using delusions mapping):", {
    delusionId: delusionId?.toString(),
    isLoading,
    hasData: !!data,
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : [],
    data,
    error: error?.message,
  });

  // Parse data from contract mapping: [id, creator, description, deadline, believePool, doubtPool, status, result]
  const delusion: Delusion | undefined = data ? {
    id: (data as any)[0] as bigint,
    creator: (data as any)[1] as `0x${string}`,
    description: (data as any)[2] as string,
    deadline: (data as any)[3] as bigint,
    believePool: (data as any)[4] as bigint,
    doubtPool: (data as any)[5] as bigint,
    status: (data as any)[6] as DelusionStatus,
    result: (data as any)[7] as boolean,
  } : undefined;

  console.log("useGetDelusion parsed:", {
    delusionId: delusionId?.toString(),
    hasParsedDelusion: !!delusion,
    description: delusion?.description,
    creator: delusion?.creator,
    believePool: delusion?.believePool?.toString(),
  });

  return {
    delusion,
    error,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get user's stake in a delusion
 */
export function useGetUserStake(
  delusionId: bigint | undefined,
  userAddress: Address | undefined
) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: deluluAbi,
    functionName: "getUserStake",
    args:
      delusionId !== undefined && userAddress
        ? [delusionId, userAddress]
        : undefined,
    query: {
      enabled:
        delusionId !== undefined && delusionId > BigInt(0) && !!userAddress,
    },
  });

  // Parse data from contract: [position, amount, claimed]
  const userStake: UserStake | undefined = data ? {
    position: (data as any)[0] as StakePosition,
    amount: (data as any)[1] as bigint,
    claimed: (data as any)[2] as boolean,
  } : undefined;

  return {
    userStake,
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

  console.log("useGetDelusionCounter:", {
    isLoading,
    counter: data?.toString(),
    error: error?.message,
  });

  return {
    counter: data as bigint | undefined,
    error,
    isLoading,
    refetch,
  };
}

/**
 * Hook to fetch all delusions
 * Fetches delusions from 1 to delusionCounter
 */
export function useGetAllDelusions() {
  const { counter, isLoading: isLoadingCounter } = useGetDelusionCounter();
  
  const totalDelusions = counter ? Number(counter) : 0;
  
  // Create array of IDs from 1 to counter
  const delusionIds = totalDelusions > 0 
    ? Array.from({ length: totalDelusions }, (_, i) => BigInt(i + 1))
    : [];

  return {
    delusionIds,
    totalDelusions,
    isLoadingCounter,
  };
}
