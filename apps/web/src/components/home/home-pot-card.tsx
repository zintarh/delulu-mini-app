"use client";

import Link from "next/link";
import { Trophy } from "@/components/ds";
import { WatchHowItWorks } from "@/components/how-it-works-video";
import { ACTIVE_POT } from "@/lib/pool/tickets";
import { TicketLadder } from "@/components/pot/stake-tickets";
import { useAuth } from "@/hooks/use-auth";
import { useStakeRules } from "@/hooks/use-stake-rules";
import { cn } from "@/lib/utils";

const STEPS = ["Join a Bingo", "Play the card", "Earn points", "Share the pot"];
const POT = ACTIVE_POT.weeklyG.toLocaleString("en-US");

/**
 * The weekly pot on Home and sign-in. $100 shared each week, and what that
 * is in G$. G$ still cashes to a Naira bank account on the app.
 */
export function HomePotCard({ className }: { className?: string }) {
  const { address } = useAuth();
  const { rules: stakeRules } = useStakeRules(address);

  return (
    <section className={cn("relative overflow-hidden rounded-[22px] border-2 border-ink bg-yellow p-3.5 text-ink shadow-[0_4px_0_#000]", className)}>
      <Link href="/how-to-earn" className="block text-ink no-underline">
        <span className="pointer-events-none absolute -right-2 -top-1 opacity-90" aria-hidden>
          <Trophy size={52} />
        </span>
        <p className="label-mono m-0 text-[10px] text-[#5c4a0a]">What you get</p>
        <p className="m-0 mt-0.5 font-display text-[26px] font-extrabold leading-none tracking-tight">${ACTIVE_POT.weeklyUsd}</p>
        <p className="m-0 mt-1 text-[13px] font-extrabold">{POT} G$</p>
        <p className="m-0 mt-1 max-w-[85%] text-[12px] font-bold leading-snug">This is shared every week by everyone who shows up all 7 days.</p>
        <p className="m-0 mt-1 max-w-[85%] text-[12px] font-bold leading-snug">Cash your G$ to a Naira bank account on the app.</p>
      </Link>
      <ol className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2 text-[13px] font-extrabold">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] text-yellow">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <Link href="/how-to-earn#tickets" className="mt-3 block text-ink no-underline">
        <p className="m-0 mb-1.5 text-[12px] font-extrabold">Higher stake = more tickets = bigger share</p>
        <TicketLadder newcomer={stakeRules.tier === "newcomer"} dark />
      </Link>
        <p className="m-0 mt-2 text-[12px] font-bold text-[#5c4a0a]">Stick with the habit by joining a Bingo. Plus 10% back on the stake. New players are in just for showing up.</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <WatchHowItWorks className="text-[13px]" />
          <Link href="/how-it-works" className="text-[13px] font-extrabold text-ink underline decoration-2 underline-offset-2">
            How Delulu works
          </Link>
        </div>
    </section>
  );
}
