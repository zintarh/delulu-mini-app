"use client";

import { useMemo } from "react";
import { Chest, Flame, GameCard, ProgressBar } from "@/components/ds";
import { isActiveForfeit, useCreatorForfeits } from "@/hooks/use-creator-forfeits";
import { useUserStreak } from "@/hooks/useUserStreak";
import { cn } from "@/lib/utils";

/** Today's quest tally from the user's active contracts. */
export function useTodayQuests(address: string | undefined) {
  const { data } = useCreatorForfeits(address);
  return useMemo(() => {
    const active = (data ?? []).filter((f) => isActiveForfeit(f) && f.onChain?.active);
    const kept = active.filter((f) => Boolean(f.currentPeriod?.proofUrl)).length;
    return { total: active.length, kept, left: active.length - kept };
  }, [data]);
}

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

export function HomeGreeting({ name, address }: { name: string; address: string | undefined }) {
  const { total, left } = useTodayQuests(address);
  const sub =
    total === 0
      ? "Make today count."
      : left === 0
        ? "All done today. Nice work."
        : left === 1
          ? "One quest left. Keep the fire going."
          : `${left} quests left today.`;
  return (
    <div className="animate-rise">
      <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">
        {greetingFor()}, {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

/** Daily goal bar with the chest that opens when every quest is kept. */
export function DailyGoalCardView({ kept, total }: { kept: number; total: number }) {
  if (total === 0) return null;
  const done = kept >= total;
  return (
    <GameCard className="flex animate-rise items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-extrabold">Daily goal</span>
          <span className="font-mono text-[11px] font-semibold">
            {kept} / {total}
          </span>
        </div>
        <ProgressBar value={kept / total} className="mt-2.5" label="Daily goal" />
        <div className="label-mono mt-2 text-[10px] text-muted-foreground">
          {done ? "Chest opened. See you tomorrow" : `Finish all ${total} to open the chest`}
        </div>
      </div>
      <span className={cn("inline-block shrink-0", !done && "animate-wiggle")}>
        <Chest size={56} />
      </span>
    </GameCard>
  );
}

export function DailyGoalCard({ address }: { address: string }) {
  const { total, kept } = useTodayQuests(address);
  return <DailyGoalCardView kept={kept} total={total} />;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Last 7 days as flames (today highlighted). Index 6 is today. */
export function WeekFlamesView({ last7Days }: { last7Days: boolean[] }) {
  const today = new Date();
  return (
    <GameCard className="grid animate-rise grid-cols-7 gap-0.5 px-1.5 py-3">
      {last7Days.map((lit, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const isToday = i === 6;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "flex aspect-square w-full max-w-[38px] items-center justify-center",
                isToday && "rounded-xl border-2 border-yellow-line bg-yellow-soft",
              )}
            >
              <Flame size={isToday ? 22 : 24} lit={lit} />
            </span>
            <span className={cn("font-mono text-[10px]", isToday ? "font-semibold" : "text-muted-foreground")}>
              {DAY_LETTERS[d.getDay()]}
            </span>
          </div>
        );
      })}
    </GameCard>
  );
}

export function WeekFlames({ address }: { address: string }) {
  const { last7Days } = useUserStreak(address);
  return <WeekFlamesView last7Days={last7Days} />;
}
