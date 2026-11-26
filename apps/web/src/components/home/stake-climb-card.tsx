"use client";

import Link from "next/link";
import { ChevronRight, Gift, TrendingUp } from "lucide-react";
import { POINTS_PER_STAKE_DIVISOR, POINTS_STAKE_CAP } from "@/lib/season/rules";
import { CONSISTENCY_BOOST_PER_DAY } from "@/lib/leaderboard/windows";
import { cn } from "@/lib/utils";

/**
 * "Higher stake, higher you climb": the leaderboard rule in one look.
 * A kept day scores stake ÷ 10 points (counted up to a 100k stake), and each
 * day kept adds 10% (lib/season/rules.ts, lib/leaderboard/windows.ts). No G$?
 * Claim the free daily G$ and stake it on your card.
 *
 * Kept small where everyone passes (Home, leaderboard: one line); the full
 * card with the bars is only on How to earn.
 */
const EXAMPLES = [1_000, 10_000, POINTS_STAKE_CAP] as const;
const points = (stake: number) => Math.floor(Math.min(stake, POINTS_STAKE_CAP) / POINTS_PER_STAKE_DIVISOR);
const k = (n: number) => (n >= 1000 ? `${n / 1000}K` : String(n));
const fmt = (n: number) => n.toLocaleString("en-US");
const BOOST = Math.round(CONSISTENCY_BOOST_PER_DAY * 100);
/** Bar heights, rising left to right. Log scale so the 1K bar still shows. */
const HEIGHTS = ["h-7", "h-12", "h-[72px]"] as const;

export function StakeClimbCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <Link
        href="/how-to-earn#climb"
        className={cn("flex items-center gap-3 rounded-2xl border-2 border-ink bg-yellow py-2.5 pl-3 pr-2 text-ink no-underline shadow-[0_3px_0_#161615]", className)}
      >
        <TrendingUp className="h-6 w-6 shrink-0" strokeWidth={2.6} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-extrabold leading-tight">Higher stake, higher you climb</span>
          <span className="block text-[11px] font-bold text-[#5c4a0a]">
            {k(EXAMPLES[1])} G$ = {fmt(points(EXAMPLES[1]))} pts a day. No G$? Claim free daily and stake it.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </Link>
    );
  }

  return (
    <section id="climb" className={cn("scroll-mt-20 rounded-[22px] border-2 border-ink bg-white p-3.5 text-ink shadow-[0_4px_0_#000]", className)} aria-label="Higher stake, higher you climb">
      <p className="label-mono m-0 text-[10px] text-muted-foreground">How to climb the leaderboard</p>
      <h2 className="m-0 mt-0.5 font-display text-[22px] font-extrabold uppercase leading-[1.05] tracking-tight">
        Higher stake,
        <br />
        <span className="bg-yellow px-[0.08em]">higher you climb</span>
      </h2>

      {/* Rising bars: stake → points for every day you keep. */}
      <div className="mt-3 grid grid-cols-3 items-end gap-2">
        {EXAMPLES.map((stake, i) => (
          <div key={stake} className="flex flex-col items-center">
            <span className="font-display text-[15px] font-extrabold leading-none tabular-nums">{fmt(points(stake))}</span>
            <span className="text-[9px] font-bold text-muted-foreground">pts a day</span>
            <span className={cn("mt-1 w-full rounded-t-lg border-2 border-b-0 border-ink", HEIGHTS[i], i === EXAMPLES.length - 1 ? "bg-yellow" : i === 1 ? "bg-yellow/60" : "bg-yellow-soft")} />
            <span className="w-full rounded-b-lg bg-ink py-1 text-center text-[11px] font-extrabold text-white">{k(stake)} G$</span>
          </div>
        ))}
      </div>
      <p className="m-0 mt-2 text-center text-[12px] font-extrabold">+{BOOST}% more for every day you keep it</p>

      {/* No G$? The free daily claim is the way in. */}
      <div className="mt-3 rounded-2xl bg-green-soft p-2.5">
        <p className="m-0 text-[12px] font-extrabold text-green-edge">No G$? It&apos;s free every day:</p>
        <ol className="m-0 mt-1.5 flex list-none items-center gap-1 p-0 text-[12px] font-extrabold">
          <li className="flex items-center gap-1">
            <Gift className="h-4 w-4 shrink-0 text-green-edge" /> Claim daily
          </li>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-green-edge" aria-hidden />
          <li>Stake it on your card</li>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-green-edge" aria-hidden />
          <li className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 shrink-0 text-green-edge" /> Climb
          </li>
        </ol>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Link href="/explore" className="text-[13px] font-extrabold text-ink underline decoration-2 underline-offset-2">
          Pick a card
        </Link>
        <Link href="/leaderboard" className="text-[13px] font-extrabold text-ink underline decoration-2 underline-offset-2">
          See the leaderboard
        </Link>
      </div>
    </section>
  );
}
