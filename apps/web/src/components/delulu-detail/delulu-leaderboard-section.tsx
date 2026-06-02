"use client";

import { Trophy } from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import type { DeluluLeaderboardEntry } from "@/app/(main)/delulu/[id]/delulu-page-helpers";

export function DeluluLeaderboardSection({
  leaderboard,
}: {
  leaderboard: DeluluLeaderboardEntry[];
}) {
  if (leaderboard.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-black mb-4 text-foreground">Top Supporters</h2>
      <div className="space-y-3">
        {leaderboard.map((entry) => (
          <div
            key={entry.address}
            className="p-4 bg-card border border-border rounded-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-delulu-yellow-reserved rounded-full flex items-center justify-center font-black text-delulu-charcoal">
                {entry.rank}
              </div>
              <div>
                <p className="font-bold text-foreground">
                  @{entry.username || formatAddress(entry.address)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.totalStake.toFixed(2)} staked
                </p>
              </div>
            </div>
            <Trophy
              className={cn(
                "w-5 h-5",
                entry.rank === 1 ? "text-yellow-400" : "text-muted-foreground/40",
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
