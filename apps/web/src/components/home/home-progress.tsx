"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Flame, GameCard, LuluScene, ProgressBar, luluWeatherFor, type LuluWeather } from "@/components/ds";
import { useUserStreak } from "@/hooks/useUserStreak";
import { isActiveForfeit, useCreatorForfeits } from "@/hooks/use-creator-forfeits";
import { cn } from "@/lib/utils";
import { HomeDailyGoalSkeleton } from "@/components/delulu-skeleton";
import { HeartHandshake } from "lucide-react";
import { HowToEarnLink } from "@/components/home/how-to-earn-link";
import { useDaypart } from "@/hooks/use-daypart";
import type { Daypart } from "@/lib/daypart/daypart";

/** Today's quest tally from the user's active contracts. */
export function useTodayQuests(address: string | undefined) {
  const { data, isLoading } = useCreatorForfeits(address);
  return useMemo(() => {
    const active = (data ?? []).filter((f) => isActiveForfeit(f) && f.onChain?.active);
    // Kept today = the current period already has a proof, or the previous
    // one was proven today (proving a day moves the contract to the next
    // period straight away).
    const ok = (p: { proofUrl: string | null; verifierAction: string | null } | null | undefined) =>
      Boolean(p?.proofUrl) && p?.verifierAction !== "rejected" && p?.verifierAction !== "timed_out";
    const today = new Date().toDateString();
    const isKept = (f: (typeof active)[number]) => {
      const idx = f.onChain?.currentPeriodIndex ?? 0;
      const current = f.periods?.find((x) => x.periodIndex === idx) ?? f.currentPeriod;
      if (ok(current)) return true;
      const previous = f.periods?.find((x) => x.periodIndex === idx - 1);
      return ok(previous) && !!previous?.resolvedAt && new Date(previous.resolvedAt).toDateString() === today;
    };
    const kept = active.filter(isKept).length;
    /** Still to prove today — Lulu counts these down. */
    const pendingItems = active.filter((f) => !isKept(f));
    // isLoading: no answer yet — callers hold their spot rather than show the
    // "no contracts" version and then swap it out a moment later.
    return { total: active.length, kept, left: active.length - kept, pendingItems, isLoading };
  }, [data, isLoading]);
}

/** Greeting on the same clock as the page wash: rise and shine at dawn, still up at night. */
function greetingFor(part: Daypart, name: string | null, date = new Date()): string {
  const who = name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
  switch (part) {
    case "dawn":
      return who ? `Rise and shine, ${who}` : "Rise and shine";
    case "day":
      if (date.getHours() < 12) return who ? `Morning, ${who}` : "Good morning";
      return who ? `Afternoon, ${who}` : "Good afternoon";
    case "dusk":
      return who ? `Evening, ${who}` : "Good evening";
    case "night":
      return who ? `Still up, ${who}?` : "Still up?";
  }
}

export function HomeGreeting({ name, address }: { name: string; address: string | undefined }) {
  const { total, left, isLoading } = useTodayQuests(address);
  const daypart = useDaypart();
  const sub = isLoading
    ? null
    : total === 0
      ? "Make today count."
      : left === 0
        ? "All done today. Nice work."
        : left === 1
          ? "One quest left. Keep the fire going."
          : `${left} quests left today.`;
  return (
    <div className="animate-rise">
      <div className="flex items-start justify-between gap-3">
        <h1 className="m-0 min-w-0 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">
          {/* No name yet (guest / new account): just the greeting, never "Morning, There". */}
          {greetingFor(daypart, name || null)}
        </h1>
        <HowToEarnLink className="mt-1.5" />
      </div>
      {/* Same height while loading, so nothing below jumps when the line arrives. */}
      <div className="mt-1 flex min-h-5 items-center justify-between gap-3">
        <p className="m-0 min-w-0 text-sm text-muted-foreground">{sub}</p>
        <Link
          href="/support"
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-extrabold text-ink no-underline night:text-white"
        >
          <HeartHandshake className="h-3.5 w-3.5 text-pink" strokeWidth={2.6} /> Support others
        </Link>
      </div>
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
          <span className="text-base font-extrabold">Daily goal</span>
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
  const { total, kept, isLoading } = useTodayQuests(address);
  const { daysSinceKept } = useUserStreak(address);
  if (isLoading) return <HomeDailyGoalSkeleton />;
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
