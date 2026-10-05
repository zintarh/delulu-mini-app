"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Loader2 } from "lucide-react";
import { CheckDot, CoinStack, GameButton, GameCard } from "@/components/ds";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useClaimPanel } from "@/contexts/right-panel-context";

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);
  if (!target) return null;
  const left = Math.max(0, Math.floor((target.getTime() - now) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(left / 3600))}:${p(Math.floor(left / 60) % 60)}:${p(left % 60)}`;
}

/**
 * Free daily money (GoodDollar UBI) on Home.
 * Verified: claim in one tap, then a countdown to the next claim.
 * Not verified: a "Verify & claim" card that opens the claim/verify panel.
 */
export function DailyMoneyCard() {
  const { isLoading, isInitialized, isWhitelisted, hasClaimed, entitlement, nextClaimTime, claim, isClaiming } =
    useGoodDollarClaim();
  const { open: openClaimPanel } = useClaimPanel();
  const countdown = useCountdown(hasClaimed ? nextClaimTime : null);

  const amount = useMemo(() => {
    if (entitlement === null) return null;
    const n = parseFloat(formatUnits(entitlement, 18));
    return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : null;
  }, [entitlement]);

  if (isLoading || !isInitialized) {
    return <div className="h-[84px] animate-pulse rounded-[20px] border-2 border-line bg-white" aria-hidden />;
  }

  if (!isWhitelisted) {
    return (
      <button type="button" onClick={openClaimPanel} className="block w-full text-left">
        <GameCard tone="blue" className="flex items-center gap-3 py-3 pl-3.5 pr-3">
          <CoinStack locked />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="label-mono text-blue">Free daily money</span>
            <span className="text-base font-extrabold leading-tight">Claim free money every day</span>
            <span className="text-xs text-muted-foreground">One quick face check · plus 10× points</span>
          </div>
          <span className="inline-flex h-10 shrink-0 items-center rounded-xl bg-blue px-3.5 text-[13px] font-extrabold uppercase tracking-[0.06em] text-white shadow-edge-blue">
            Verify &amp; claim
          </span>
        </GameCard>
      </button>
    );
  }

  const canClaim = !hasClaimed && entitlement !== null && entitlement > 0n;

  return (
    <GameCard tone="green" className="flex items-center gap-3 py-3 pl-3.5 pr-3">
      <CoinStack />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="label-mono text-green-edge">Free daily money</span>
        {canClaim ? (
          <>
            <span className="font-display text-[28px] font-extrabold leading-none">{amount} G$</span>
            <span className="text-xs text-muted-foreground">From GoodDollar · ready now</span>
          </>
        ) : (
          <>
            <span className="text-[17px] font-extrabold leading-tight">Claimed for today</span>
            {countdown && (
              <span className="text-xs text-muted-foreground">
                Next in <span className="font-semibold tabular-nums text-ink">{countdown}</span>
              </span>
            )}
          </>
        )}
      </div>
      {canClaim ? (
        <GameButton variant="green" size="sm" onClick={() => void claim()} disabled={isClaiming}>
          {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Claim
        </GameButton>
      ) : (
        <span className="animate-bounce-in">
          <CheckDot size={32} />
        </span>
      )}
    </GameCard>
  );
}
