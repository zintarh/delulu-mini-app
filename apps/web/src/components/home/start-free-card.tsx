"use client";

import Link from "next/link";
import { GameCard, Lulu, gameButtonClass } from "@/components/ds";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

/**
 * Zero-balance nudge under the daily money card: the next step is claiming
 * today's free money, which is enough to start a first Bingo.
 */
export function StartFreeCard() {
  const { balance, formatted } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  // Only once the balance is actually known — before that it reads as "0",
  // which flashed this card up and then away for people who do hold G$.
  if (!balance || Number(formatted) > 0) return null;

  return (
    <GameCard className="flex animate-rise items-center gap-3 py-3 pl-3.5 pr-3">
      <Lulu size={44} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-base font-extrabold leading-tight">You have 0 G$</p>
        <p className="m-0 mt-0.5 text-xs leading-snug text-muted-foreground">Claim your free money to start your first Bingo</p>
      </div>
      <Link href="/daily-claim" className={gameButtonClass({ size: "sm", className: "shrink-0 px-4" })}>
        Claim
      </Link>
    </GameCard>
  );
}
