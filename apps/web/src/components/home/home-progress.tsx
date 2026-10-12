"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Flame, GameCard, LuluScene, ProgressBar, luluWeatherFor, type LuluWeather } from "@/components/ds";
import { useUserStreak } from "@/hooks/useUserStreak";
import { isActiveForfeit, useCreatorForfeits } from "@/hooks/use-creator-forfeits";
import { cn } from "@/lib/utils";

/** Today's quest tally from the user's active contracts. */
export function useTodayQuests(address: string | undefined) {
  const { data } = useCreatorForfeits(address);
  return useMemo(() => {
    const active = (data ?? []).filter((f) => isActiveForfeit(f) && f.onChain?.active);
    // Kept today = the current period already has a proof, or the previous
    // one was proven today (proving a day moves the contract to the next
    // period straight away).
    const ok = (p: { proofUrl: string | null; verifierAction: string | null } | null | undefined) =>
      Boolean(p?.proofUrl) && p?.verifierAction !== "rejected" && p?.verifierAction !== "timed_out";
    const today = new Date().toDateString();
    const kept = active.filter((f) => {
      const idx = f.onChain?.currentPeriodIndex ?? 0;
      const current = f.periods?.find((x) => x.periodIndex === idx) ?? f.currentPeriod;
      if (ok(current)) return true;
      const previous = f.periods?.find((x) => x.periodIndex === idx - 1);
      return ok(previous) && !!previous?.resolvedAt && new Date(previous.resolvedAt).toDateString() === today;
    }).length;
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
        {greetingFor()}, {name.charAt(0).toUpperCase() + name.slice(1)}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

/** One short line under the bar; missed days take over from the progress hint. */
function goalHint(weather: LuluWeather, total: number, daysSinceKept: number | null): string {
  if (weather === "storm") return "It's cold without you. Come back";
  if (weather === "sad") return `${(daysSinceKept ?? 1) - 1} days missed. Lulu's sad`;
  if (weather === "gloomy") return "Lulu missed you yesterday";
  if (total === 0) return "Start a contract. Lulu's waiting";
  if (weather === "sunny") return "Lulu's happy. See you tomorrow";
  return total === 1 ? "Keep it today to make Lulu's day" : `Keep all ${total} to make Lulu's day`;
}

/** Daily goal bar, with Lulu showing how your habits are going. */
export function DailyGoalCardView({
  kept,
  total,
  daysSinceKept = null,
}: {
  kept: number;
  total: number;
  daysSinceKept?: number | null;
}) {
  const done = total > 0 && kept >= total;
  const weather = luluWeatherFor({ keptToday: done, daysSinceKept });
  const card = (
    <GameCard className="flex animate-rise items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-extrabold">Daily goal</span>
          <span className=" tracking-tighter text-[11px] font-semibold text-ink">
            {kept} / {total}
          </span>
        </div>
        <ProgressBar value={total > 0 ? kept / total : 0} className="mt-2.5" label="Daily goal" />
        <div className="label-mono mt-2 text-[10px] text-muted-foreground">{goalHint(weather, total, daysSinceKept)}</div>
      </div>
      <LuluScene weather={weather} />
    </GameCard>
  );
  // Nothing running yet: the whole card is the way in.
  return total === 0 ? (
    <Link href="/forfeit" className="block text-ink no-underline">
      {card}
    </Link>
  ) : (
    card
  );
}

export function DailyGoalCard({ address }: { address: string }) {
  const { total, kept } = useTodayQuests(address);
  const { daysSinceKept } = useUserStreak(address);
  return <DailyGoalCardView kept={kept} total={total} daysSinceKept={daysSinceKept} />;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Last 7 days as flames (today highlighted). Index 6 is today. */
export function WeekFlamesView({ last7Days, className }: { last7Days: boolean[]; className?: string }) {
  const today = new Date();
  return (
    <GameCard className={cn("flex animate-rise justify-between px-2 py-3 min-[360px]:px-3.5", className)}>
      {last7Days.map((lit, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const isToday = i === 6;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "flex h-[34px] w-[34px] items-center justify-center min-[360px]:h-[38px] min-[360px]:w-[38px]",
                isToday && "rounded-xl border-2 border-yellow-line bg-yellow-soft",
              )}
            >
              <Flame size={24} lit={lit} />
            </span>
            <span className={cn("label-mono text-[10px]", isToday ? "font-semibold text-ink" : "text-muted-foreground")}>
              {DAY_LETTERS[d.getDay()]}
            </span>
          </div>
        );
      })}
    </GameCard>
  );
}
