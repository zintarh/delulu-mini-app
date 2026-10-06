"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Loader2, Lock } from "lucide-react";
import { CheckDot, Chest, CoinStack, GameButton, GameCard } from "@/components/ds";
import { cn } from "@/lib/utils";
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

export type DailyMoneyState = "loading" | "verify" | "claimable" | "claimed";

/** Presentational card — every state, no data fetching (see DailyMoneyCard). */
export function DailyMoneyCardView({
  state,
  amount,
  countdown,
  claiming = false,
  onClaim,
  onVerify,
}: {
  state: DailyMoneyState;
  amount?: string | null;
  countdown?: string | null;
  claiming?: boolean;
  onClaim?: () => void;
  onVerify?: () => void;
}) {
  if (state === "loading") {
    return (
      <GameCard className="flex items-center gap-3 px-3.5 py-3" aria-busy="true" aria-label="Loading free daily money">
        <span className="h-11 w-12 shrink-0 animate-pulse rounded-full bg-line" />
        <div className="flex flex-1 flex-col gap-2">
          <span className="h-2.5 w-24 animate-pulse rounded bg-line" />
          <span className="h-5 w-32 animate-pulse rounded bg-line" />
        </div>
      </GameCard>
    );
  }

  if (state === "verify") {
    return (
      <GameCard tone="blue" className="flex flex-col gap-3 p-3.5">
        <div className="flex items-center gap-3">
          <CoinStack locked />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="label-mono truncate text-blue">Free daily money</span>
            <span className="text-base font-extrabold leading-tight">Claim free money every day</span>
            <span className="text-xs leading-snug text-muted-foreground">One quick face check · plus 10× points</span>
          </div>
        </div>
        <GameButton variant="blue" size="sm" full onClick={onVerify}>
          Verify &amp; claim
        </GameButton>
      </GameCard>
    );
  }

  return (
    <GameCard tone="green" className="flex items-center gap-3 py-3 pl-3.5 pr-3">
      <CoinStack />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="label-mono truncate text-green-edge">Free daily money</span>
        {state === "claimable" ? (
          <>
            <span className="truncate font-display text-[clamp(20px,7.2vw,28px)] font-extrabold leading-none">
              {amount} G$
            </span>
            <span className="truncate text-xs text-muted-foreground">From GoodDollar · ready now</span>
          </>
        ) : (
          <>
            <span className="text-[17px] font-extrabold leading-tight">Claimed for today</span>
            {countdown ? (
              <span className="text-xs text-muted-foreground">
                Next in <span className="font-semibold tabular-nums text-ink">{countdown}</span>
              </span>
            ) : null}
          </>
        )}
      </div>
      {state === "claimable" ? (
        <GameButton variant="green" size="sm" className="shrink-0 px-4" onClick={onClaim} disabled={claiming}>
          {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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

/**
 * Free daily money (GoodDollar UBI) on Home and Rewards.
 * Verified: claim in one tap, then a countdown to the next claim.
 * Not verified: opens the claim/verify panel.
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

  const canClaim = !hasClaimed && entitlement !== null && entitlement > 0n;
  const state: DailyMoneyState =
    isLoading || !isInitialized ? "loading" : !isWhitelisted ? "verify" : canClaim ? "claimable" : "claimed";

  return (
    <DailyMoneyCardView
      state={state}
      amount={amount}
      countdown={countdown}
      claiming={isClaiming}
      onClaim={() => void claim()}
      onVerify={openClaimPanel}
    />
  );
}

/**
 * Daily G$ chest on Rewards (design: Rewards.dc.html): yellow when today's
 * money is ready, blue verify prompt before face verification, quiet once
 * claimed.
 */
export function RewardsDailyCard() {
  const { isLoading, isInitialized, isWhitelisted, hasClaimed, entitlement, nextClaimTime, claim, isClaiming } =
    useGoodDollarClaim();
  const { open: openClaimPanel } = useClaimPanel();
  const countdown = useCountdown(hasClaimed ? nextClaimTime : null);
  const canClaim = !hasClaimed && entitlement !== null && entitlement > 0n;

  if (isLoading || !isInitialized) {
    return <div className="h-[112px] animate-pulse rounded-[20px] bg-yellow-soft" aria-busy="true" />;
  }

  if (!isWhitelisted) {
    return (
      <div className="flex animate-rise items-center gap-4 rounded-[20px] border-2 border-blue-line bg-blue-soft p-4 shadow-edge-blue-line">
        <span className="relative">
          <Chest size={76} grey />
          <span className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-ink text-white">
            <Lock className="h-3 w-3" strokeWidth={2.6} />
          </span>
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <div>
            <div className="text-[17px] font-extrabold">Daily G$</div>
            <div className="label-mono mt-0.5 text-[10px] text-blue">Free every day · verify to unlock</div>
          </div>
          <GameButton variant="blue" size="sm" className="self-start" onClick={openClaimPanel}>
            Verify
          </GameButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex animate-rise items-center gap-4 rounded-[20px] border-2 p-4",
        canClaim ? "border-yellow-line bg-yellow-soft shadow-edge-yellow-line" : "border-line bg-white shadow-edge",
      )}
    >
      <span className={cn("inline-block", canClaim && "animate-wiggle")}>
        <Chest size={76} grey={!canClaim} />
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <div>
          <div className="text-[17px] font-extrabold">Daily G$</div>
          <div className={cn("label-mono mt-0.5 text-[10px]", canClaim ? "text-green-edge" : "text-muted-foreground")}>
            {canClaim ? "Face verified · ready" : countdown ? `Opened · next in ${countdown}` : "Opened for today"}
          </div>
        </div>
        {canClaim ? (
          <GameButton variant="ink" size="sm" className="self-start" onClick={() => void claim()} disabled={isClaiming}>
            {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Open
          </GameButton>
        ) : null}
      </div>
    </div>
  );
}
