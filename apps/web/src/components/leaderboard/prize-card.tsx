"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Trophy } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtUsd } from "@/lib/earn/format";
import { PRIZE, fortnightWindow } from "@/lib/leaderboard/windows";
import { cn } from "@/lib/utils";

/**
 * The 2-week leaderboard prize, where it means something (Rewards, right after
 * a photo) instead of on Home: the pool, your rank this round, days left.
 */
export function LeaderboardPrizeCard({ className }: { className?: string }) {
  const { address } = useAuth();
  const facts = useEarnFacts();
  const { myRankEntry, isRankLoading } = useAllUsersLeaderboard(0, address, undefined, "fortnight");
  const round = fortnightWindow();
  const daysLeft = Math.max(1, Math.ceil((round.endMs - Date.now()) / 86_400_000));
  const usd = facts ? fmtUsd(PRIZE.poolG * facts.gdUsd) : null;
  const inPrize = !!myRankEntry && myRankEntry.rank <= PRIZE.winners;
  const you = isRankLoading
    ? " "
    : myRankEntry
      ? `You're #${myRankEntry.rank}${inPrize ? " — in the prize" : ""} · ${myRankEntry.points.toLocaleString("en-US")} pts`
      : "Post today to get on the board";

  return (
    <Link
      href="/leaderboard"
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
          Top {PRIZE.winners} share <span className="text-yellow">{PRIZE.poolG.toLocaleString("en-US")} G$</span>
          {usd ? <span className="font-bold text-white/70"> ≈ {usd}</span> : null}
        </span>
        <span className={cn("block truncate text-[11px] font-semibold", inPrize ? "text-green" : "text-white/70")}>
          {you} · {daysLeft} {daysLeft === 1 ? "day" : "days"} left
        </span>
      </span>
      <ChevronRight className="relative h-4 w-4 shrink-0 text-white/60" />
    </Link>
  );
}
