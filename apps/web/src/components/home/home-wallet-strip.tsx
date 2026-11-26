"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Gift, Loader2, ShieldCheck, ShoppingBag } from "lucide-react";
import { Coin } from "@/components/ds";
import { useReportHomeReady } from "@/components/home/home-ready";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useFaceCheck } from "@/contexts/right-panel-context";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { BUY_GD_URL } from "@/lib/buy-gd";
import { afterVote } from "@/lib/vote-gate";
import { cn } from "@/lib/utils";

/** Where to buy more G$ (lib/buy-gd.ts). Kept under the old name for existing imports. */
export const GET_GD_URL = BUY_GD_URL;

const fmtG = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : Math.floor(n).toLocaleString("en-US");

/** "1:00 PM" / "tomorrow 1:00 PM" — GoodDollar's claim day starts at a fixed time. */
function nextLabel(next: Date | null) {
  if (!next) return null;
  const time = next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return new Date().toDateString() === next.toDateString() ? time : `tomorrow ${time}`;
}

/**
 * Home's money row, in G$: what you hold, today's G$ price, and the two ways to
 * get more — the free daily claim (verify → claim → next time) and a swap.
 * Replaces the big daily-money card: one compact strip, always in the same place.
 */
export function HomeWalletStrip({ className }: { className?: string }) {
  const { formatted, isLoading: balanceLoading } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const { usd } = useGoodDollarPrice();
  const { isInitialized, isWhitelisted, hasClaimed, entitlement, nextClaimTime, claim, isClaiming, sdkReady } = useGoodDollarClaim();
  const { start: startFaceCheck } = useFaceCheck();
  useReportHomeReady("money", isInitialized);

  const balance = Number(formatted) || 0;
  const claimable = useMemo(() => (entitlement != null && entitlement > 0n && !hasClaimed ? Number(formatUnits(entitlement, 18)) : 0), [entitlement, hasClaimed]);
  const perK = usd ? usd * 1000 : null;

  const claimButton = !isInitialized ? (
    <span className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-line">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </span>
  ) : !isWhitelisted ? (
    <button type="button" onClick={startFaceCheck} className={btn("bg-blue text-white shadow-[0_3px_0_#1f4fb8]")}>
      <ShieldCheck className="h-4 w-4" /> Verify for free G$
    </button>
  ) : claimable > 0 ? (
    <button type="button" onClick={() => void afterVote(claim)} disabled={isClaiming || !sdkReady} className={btn("bg-green text-white shadow-[0_3px_0_#1d8a52]")}>
      {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Claim {fmtG(claimable)} G$
    </button>
  ) : (
    <span className={btn("bg-paper text-muted-foreground shadow-none")}>
      <Gift className="h-4 w-4" /> {nextLabel(nextClaimTime) ? `Free G$ at ${nextLabel(nextClaimTime)}` : "Claimed today"}
    </span>
  );

  return (
    <section className={cn("rounded-[22px] border-2 border-line bg-white p-3.5 text-ink shadow-edge", className)} aria-label="Your G$">
      <div className="flex items-end justify-between gap-3">
        <Link href="/wallet" className="min-w-0 text-ink no-underline">
          <p className="label-mono m-0 text-[10px] text-muted-foreground">Your G$</p>
          <p className="m-0 mt-0.5 flex items-center gap-1.5 font-display text-[28px] font-extrabold leading-none tabular-nums">
            <Coin size={22} />
            {balanceLoading ? "…" : fmtG(balance)}
          </p>
        </Link>
        {perK ? (
          <p className="m-0 shrink-0 text-right text-[11px] font-semibold text-muted-foreground">
            G$ price
            <span className="block text-[13px] font-extrabold text-ink">1K G$ ≈ ${perK < 0.1 ? perK.toFixed(3) : perK.toFixed(2)}</span>
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2">
        {claimButton}
        <a href={GET_GD_URL} target="_blank" rel="noopener noreferrer" className={btn("flex-none bg-ink px-4 text-white shadow-[0_3px_0_#000]")}>
          <ShoppingBag className="h-4 w-4" /> Buy G$
        </a>
      </div>
    </section>
  );
}

function btn(extra: string) {
  return cn("press-edge flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-extrabold no-underline disabled:opacity-70", extra);
}
