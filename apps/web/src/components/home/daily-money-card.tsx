"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Loader2, Lock } from "lucide-react";
import { CheckDot, Chest, CoinStack, GameButton, GameCard } from "@/components/ds";
import { cn } from "@/lib/utils";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { formatCountdown } from "@/components/home-stakes-hero";
import { useFaceCheck } from "@/contexts/right-panel-context";

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

/**
 * "1:00 PM · in 4:59" — GoodDollar's claim day starts at a fixed time, not
 * midnight, so the clock time tells people *when* their money comes back
 * (the next claim is often later the same calendar day).
 */
function formatNextClaim(next: Date, now: number): string {
  const remainingSec = Math.floor((next.getTime() - now) / 1000);
  if (remainingSec <= 0) return "opening now…";
  const time = next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const when = new Date(now).toDateString() === next.toDateString() ? time : `tomorrow ${time}`;
  return `${when} · in ${formatCountdown(remainingSec).label}`;
}

/** Shared by both cards: ticks only while a next-claim time is showing. */
function useNextClaimLabel(hasClaimed: boolean, nextClaimTime: Date | null) {
  const showing = hasClaimed && nextClaimTime != null;
  const now = useNow(showing);
  return showing ? formatNextClaim(nextClaimTime!, now) : null;
}

/** "empty": verified and not yet claimed, but GoodDollar has nothing to pay out right now. */
export type DailyMoneyState = "loading" | "verify" | "claimable" | "claimed" | "empty";

/** Presentational card — every state, no data fetching (see DailyMoneyCard). */
export function DailyMoneyCardView({
  state,
  amount,
  nextClaim,
  claiming = false,
  onClaim,
  onVerify,
}: {
  state: DailyMoneyState;
  amount?: string | null;
  /** Pre-formatted, e.g. "1:00 PM · in 4:59". */
  nextClaim?: string | null;
  claiming?: boolean;
  onClaim?: () => void;
  onVerify?: () => void;
}) {
  if (state === "loading") {
    return (
      <GameCard tone="green" className="flex items-center gap-3 py-3 pl-3.5 pr-3" aria-busy="true" aria-label="Loading free daily money">
        <CoinStack />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="label-mono truncate text-green-edge">Free daily money</span>
          <span className="h-7 w-28 animate-pulse rounded-md bg-green-line/60" />
          <span className="text-xs text-muted-foreground">From GoodDollar</span>
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
        ) : state === "empty" ? (
          <>
            <span className="text-[17px] font-extrabold leading-tight">Nothing to claim yet</span>
            <span className="truncate text-xs text-muted-foreground">From GoodDollar · check back soon</span>
          </>
        ) : (
          <>
            <span className="text-[17px] font-extrabold leading-tight">Claimed</span>
            {nextClaim ? (
              <span className="truncate text-xs text-muted-foreground">
                Next <span className="font-semibold tabular-nums text-ink">{nextClaim}</span>
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
      ) : state === "claimed" ? (
        <span className="animate-bounce-in">
          <CheckDot size={32} />
        </span>
      ) : null}
    </GameCard>
  );
}

/**
 * Free daily money (GoodDollar UBI) on Home and Rewards.
 * Verified: claim in one tap, then a countdown to the next claim.
 * Not verified: opens the claim/verify panel.
 */
export function DailyMoneyCard() {
  const { isInitialized, isWhitelisted, hasClaimed, entitlement, nextClaimTime, claim, isClaiming, sdkReady } =
    useGoodDollarClaim();
  const { start: startFaceCheck } = useFaceCheck();
  const nextClaim = useNextClaimLabel(hasClaimed, nextClaimTime);

  const amount = useMemo(() => {
    if (entitlement === null) return null;
    const n = parseFloat(formatUnits(entitlement, 18));
    return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : null;
  }, [entitlement]);

  const canClaim = !hasClaimed && entitlement !== null && entitlement > 0n;
  const state: DailyMoneyState =
    !isInitialized
      ? "loading"
      : !isWhitelisted
        ? "verify"
        : canClaim
          ? "claimable"
          : hasClaimed
            ? "claimed"
            : "empty";

  return (
    <DailyMoneyCardView
      state={state}
      amount={amount}
      nextClaim={nextClaim}
      // The claim itself needs the wallet; until it connects the button waits.
      claiming={isClaiming || !sdkReady}
      onClaim={() => void claim()}
      onVerify={startFaceCheck}
    />
  );
}

/**
 * Daily G$ chest on Rewards (design: Rewards.dc.html): yellow when today's
 * money is ready, blue verify prompt before face verification, quiet once
 * claimed.
 */
export function RewardsDailyCard() {
  const { isInitialized, isWhitelisted, hasClaimed, entitlement, nextClaimTime, claim, isClaiming, sdkReady } =
    useGoodDollarClaim();
  const { start: startFaceCheck } = useFaceCheck();
  const nextClaim = useNextClaimLabel(hasClaimed, nextClaimTime);
  const canClaim = !hasClaimed && entitlement !== null && entitlement > 0n;

  if (!isInitialized) {
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
          <GameButton variant="blue" size="sm" className="self-start" onClick={startFaceCheck}>
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
            {canClaim
              ? "Face verified · ready"
              : !hasClaimed
                ? "Nothing to open yet · check back soon"
                : nextClaim
                  ? `Opened · next ${nextClaim}`
                  : "Opened"}
          </div>
        </div>
        {canClaim ? (
          <GameButton variant="ink" size="sm" className="self-start" onClick={() => void claim()} disabled={isClaiming || !sdkReady}>
            {isClaiming || !sdkReady ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Open
          </GameButton>
        ) : null}
      </div>
    </div>
  );
}
