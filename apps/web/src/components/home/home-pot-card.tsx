"use client";

import Link from "next/link";
import { Trophy } from "@/components/ds";
import { WatchHowItWorks } from "@/components/how-it-works-video";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtUsd } from "@/lib/earn/format";
import { ACTIVE_POT } from "@/lib/pool/tickets";
import { cn } from "@/lib/utils";

const STEPS = ["Join a Bingo", "Play the card", "Earn points", "Share the pot"];

const g = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-US"));

/**
 * The weekly pot on Home. One card for everyone: the pot, what it's worth in
 * dollars, and how you qualify. No personal share or payout estimate.
 */
export function HomePotCard({ className }: { className?: string }) {
  const facts = useEarnFacts();
  const usd = facts ? fmtUsd(ACTIVE_POT.weeklyG * facts.gdUsd) : null;

  return (
    <section className={cn("relative overflow-hidden rounded-[22px] border-2 border-ink bg-yellow p-3.5 text-ink shadow-[0_4px_0_#000]", className)}>
      <Link href="/how-to-earn" className="block text-ink no-underline">
        <span className="pointer-events-none absolute -right-2 -top-1 opacity-90" aria-hidden>
          <Trophy size={52} />
        </span>
        <p className="label-mono m-0 text-[10px] text-[#5c4a0a]">What you get</p>
        <p className="m-0 mt-0.5 font-display text-[30px] font-extrabold leading-none">{g(ACTIVE_POT.weeklyG)} G$</p>
        {usd ? <p className="m-0 mt-1 text-[13px] font-extrabold">≈ {usd}</p> : null}
        <p className="m-0 mt-1 max-w-[85%] text-[12px] font-bold leading-snug">Shared every week by everyone who shows up all 7 days</p>
      </Link>
      <ol className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2 text-[13px] font-extrabold">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] text-yellow">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <p className="m-0 mt-2 text-[12px] font-bold text-[#5c4a0a]">Stick with the habit by joining a Bingo. Plus 10% back on the stake. New players are in just for showing up.</p>
      <WatchHowItWorks className="mt-3 text-[13px]" />
    </section>
  );
}
