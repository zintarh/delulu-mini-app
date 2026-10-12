"use client";

import Link from "next/link";
import { GameCard, Lulu, gameButtonClass } from "@/components/ds";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

/**
 * Zero-balance nudge under the daily money card: claim free money above, or
 * start right now with a word pledge (no money, no face check needed).
 */
export function StartFreeCard() {
  const { formatted, isLoading } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  if (isLoading || Number(formatted) > 0) return null;

  return (
    <GameCard tone="yellow" className="flex animate-rise items-center gap-3 py-3 pl-3.5 pr-3">
      <Lulu size={44} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[15px] font-extrabold leading-tight">You have 0 G$</p>
        <p className="m-0 mt-0.5 text-xs leading-snug text-muted-foreground">
          Claim free money above, or start free with just your word
        </p>
      </div>
      <Link href="/forfeit?stake=word" className={gameButtonClass({ size: "sm", className: "shrink-0 px-4" })}>
        Start free
      </Link>
    </GameCard>
  );
}
