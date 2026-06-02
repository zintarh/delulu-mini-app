"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useClaimPanel } from "@/contexts/right-panel-context";
import {
  checkGoodDollarWhitelisted,
  useClaimSDK,
} from "@/hooks/use-claim-sdk";
import type { GoodDollarWhitelistAction } from "@/lib/gooddollar-whitelist";
import { isGoodDollarToken } from "@/lib/constant";

/**
 * Before tipping or creating a delulu, ensure the wallet is GoodDollar-whitelisted.
 * If not, opens the claim panel with context and returns false.
 */
export function useRequireGoodDollarWhitelist() {
  const { authenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { claimSDK, isReady } = useClaimSDK();
  const { openForWhitelist } = useClaimPanel();
  const [isChecking, setIsChecking] = useState(false);

  const ensureWhitelisted = useCallback(
    async (
      action: GoodDollarWhitelistAction,
      tokenAddress?: string,
    ): Promise<boolean> => {
      if (tokenAddress && !isGoodDollarToken(tokenAddress)) {
        return true;
      }
      if (!authenticated) {
        const redirect =
          action === "create" ? "/board" : pathname || "/";
        router.push(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
        return false;
      }

      if (!isReady || !claimSDK) {
        openForWhitelist(action);
        return false;
      }

      setIsChecking(true);
      try {
        const whitelisted = await checkGoodDollarWhitelisted(claimSDK);
        if (whitelisted) return true;
        openForWhitelist(action);
        return false;
      } finally {
        setIsChecking(false);
      }
    },
    [authenticated, claimSDK, isReady, openForWhitelist, pathname, router],
  );

  return { ensureWhitelisted, isChecking };
}
