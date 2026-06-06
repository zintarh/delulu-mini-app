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
import { isGoodDollarToken, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useTokenBalance } from "@/hooks/use-token-balance";

/**
 * Before tipping or creating a delulu, ensure the wallet is GoodDollar-whitelisted.
 * If the user already holds G$ (sent from another account), skip the whitelist check —
 * the whitelist only gates zero-balance wallets that need to claim UBI first.
 */
export function useRequireGoodDollarWhitelist() {
  const { authenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { claimSDK, isReady } = useClaimSDK();
  const { openForWhitelist } = useClaimPanel();
  const [isChecking, setIsChecking] = useState(false);

  const { balance: gdBalance } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const gdBalanceNum = Number(gdBalance?.formatted ?? "0");
  const hasGdBalance = Number.isFinite(gdBalanceNum) && gdBalanceNum > 0;

  const ensureWhitelisted = useCallback(
    async (
      action: GoodDollarWhitelistAction,
      tokenAddress?: string,
    ): Promise<boolean> => {
      // Non-G$ tokens never need whitelist
      if (tokenAddress && !isGoodDollarToken(tokenAddress)) {
        return true;
      }
      if (!authenticated) {
        const redirect =
          action === "create" ? "/board" : pathname || "/";
        router.push(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
        return false;
      }

      // User already holds G$ — whitelist is only required to claim UBI (zero-balance)
      if (hasGdBalance) return true;

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
    [authenticated, claimSDK, hasGdBalance, isReady, openForWhitelist, pathname, router],
  );

  return { ensureWhitelisted, isChecking };
}
