"use client";

import { useAccount } from "wagmi";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

/**
 * Hook to check if user needs to complete setup (username/email)
 * Checks the contract to see if user has a profile set
 */
export function useUserSetupCheck(enabled = true) {
  const { address, isConnected } = useAccount();
  const { username, isLoading } = useUsernameByAddress(
    address as `0x${string}` | undefined,
    enabled
  );

  // User needs setup if they're connected but don't have a username on-chain
  const needsSetup =
    enabled && isConnected && !!address && !isLoading && !username;
  const isChecking =
    enabled && (isLoading || (isConnected && !address));

  return { needsSetup, isChecking };
}
