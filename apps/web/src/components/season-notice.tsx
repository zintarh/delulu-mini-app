"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Coin } from "@/components/ds";
import { cn } from "@/lib/utils";
import {
  SEASON_2_START_LABEL,
  STAKE_PRESETS_REGULAR,
  isSeason2Live,
  isSeason2PointsLive,
  seasonPointsForStake,
} from "@/lib/season/rules";

/**
 * Season 2 heads-up: before it starts, "from Monday, bigger stake = more
 * points"; once live, the same ladder as a nudge for anyone earning token
 * points. Badges over sentences — the numbers do the talking.
 */
export function SeasonNotice({
  className,
  /** Show even once the season is live (e.g. a proof that earned token points). */
  force = false,
}: {
  className?: string;
  force?: boolean;
}) {
  // Points switched on before the stake rules (Sat 21 → Mon 23 Nov).
  const live = isSeason2PointsLive();
  const rulesLive = isSeason2Live();
  if (rulesLive && !force) return null;
  return (
    <Link
      href="/forfeit"
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 border-yellow-line bg-yellow-soft px-3.5 py-3 text-left",
        className,
      )}
    >
      <Coin size={28} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-extrabold leading-tight">
          {live ? "Stake more, earn more" : `Season 2 · ${SEASON_2_START_LABEL}`}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {STAKE_PRESETS_REGULAR.map((stake) => (
            <span key={stake} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold">
              {stake / 1000}k → <span className="text-green-edge">{seasonPointsForStake(stake).toLocaleString()} pts</span>
            </span>
          ))}
        </div>
        {!rulesLive ? (
          <p className="label-mono m-0 mt-1.5 text-[10px] text-muted-foreground">
            {live ? `Points on now · min stake 5k from ${SEASON_2_START_LABEL}` : "Min stake 5k · 7 days max · new board"}
          </p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
