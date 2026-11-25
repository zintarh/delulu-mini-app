"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Trophy } from "@/components/ds";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtNgn } from "@/lib/earn/format";
import { weekWindow } from "@/lib/leaderboard/windows";
import { ACTIVE_POT } from "@/lib/pool/tickets";
import { cn } from "@/lib/utils";

/**
 * The weekly pool, shown where a payout is on the player's mind (Rewards,
 * right after a photo). $100 (1,000,000 G$) shared by everyone who shows up all 7 days.
 */
export function LeaderboardPrizeCard({ className }: { className?: string }) {
  const facts = useEarnFacts();
  const week = weekWindow();
  const daysLeft = Math.max(0, Math.ceil((week.endMs - Date.now()) / 86_400_000));
  const left = daysLeft <= 1 ? "ends today" : `${daysLeft} days left`;
  const ngn = facts ? fmtNgn(ACTIVE_POT.weeklyG * facts.gdUsd * facts.ngnPerUsd) : null;

  return (
    <Link
      href="/how-to-earn"
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-[20px] border-2 border-ink bg-ink px-3.5 py-3 text-white no-underline shadow-[0_3px_0_#000]",
        className,
      )}
    >
      <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-yellow/30 blur-2xl" aria-hidden />
      <span className="relative shrink-0">
        <Trophy size={36} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[14px] font-extrabold">
          <span className="text-yellow">${ACTIVE_POT.weeklyUsd}</span>
          <span className="font-bold text-white/70"> · {ACTIVE_POT.weeklyG.toLocaleString("en-US")} G$</span>
          {ngn ? <span className="font-bold text-white/70"> ≈ {ngn}</span> : null}
        </span>
        <span className="block truncate text-[11px] font-semibold text-white/70">
          Shared this week by everyone who shows up all 7 days · {left}
        </span>
      </span>
      <ChevronRight className="relative h-4 w-4 shrink-0 text-white/60" />
    </Link>
  );
}
