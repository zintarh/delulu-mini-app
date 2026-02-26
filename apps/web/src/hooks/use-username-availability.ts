import { useEffect, useState } from "react";
import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

const DEBOUNCE_DELAY_MS = 500; // Wait 500ms after user stops typing before checking

/**
 * Hook to check if a username is taken
 * Includes debouncing to avoid excessive contract calls while user is typing
 */
export function useUsernameAvailability(username: string | null) {
  const chainId = useChainId();
  const [debouncedUsername, setDebouncedUsername] = useState<string | null>(null);

  // Debounce username input
  useEffect(() => {
    if (!username || username.trim().length === 0) {
      setDebouncedUsername(null);
      return;
    }

    const trimmed = username.trim();
    const timer = setTimeout(() => {
      setDebouncedUsername(trimmed);
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [username]);

  const {
    data: isTaken,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "isUsernameTaken",
    args: debouncedUsername ? [debouncedUsername] : undefined,
    query: {
      enabled: !!debouncedUsername,
    },
  });

  return {
    isTaken: isTaken as boolean | undefined,
    isLoading,
    error,
    refetch,
    isAvailable: isTaken === false,
  };
}
