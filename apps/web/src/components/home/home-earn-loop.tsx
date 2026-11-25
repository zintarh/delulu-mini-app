"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Coin, Trophy } from "@/components/ds";
import { PRIZE } from "@/lib/leaderboard/windows";

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

/**
 * How Delulu pays, as three steps instead of paragraphs: stake (bigger = more
 * points), one photo a day, win (cashback + the 2-week top-10 prize). Taps
 * through to How to earn for the details.
 */
export function HomeEarnLoop() {
  const steps = [
    { art: <Coin size={22} />, title: "Stake G$", sub: "Bigger stake, more points" },
    { art: <span className="text-[20px] leading-none">📸</span>, title: "1 photo a day", sub: "Keep your streak" },
    { art: <Trophy size={24} />, title: "Win G$", sub: `Cashback + top ${PRIZE.winners} share ${k(PRIZE.poolG)}` },
  ];
  return (
    <Link href="/how-to-earn" className="press-edge block rounded-[22px] border-2 border-line bg-white px-3 py-3 text-ink no-underline shadow-edge" aria-label="How to earn">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <p className="label-mono m-0 text-[10px] text-muted-foreground">How you earn</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <ol className="m-0 grid list-none grid-cols-3 gap-1.5 p-0">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex flex-col items-center rounded-2xl bg-paper px-1.5 py-2.5 text-center">
            <span className="flex h-8 items-center">{s.art}</span>
            <span className="mt-1 text-[12px] font-extrabold leading-tight">{s.title}</span>
            <span className="mt-0.5 text-[10px] font-semibold leading-snug text-muted-foreground">{s.sub}</span>
            {i < steps.length - 1 ? (
              <span aria-hidden className="absolute -right-[9px] top-1/2 z-[1] -translate-y-1/2 text-[12px] font-extrabold text-muted-foreground">›</span>
            ) : null}
          </li>
        ))}
      </ol>
    </Link>
  );
}
