"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStreak } from "@/hooks/useUserStreak";

function getMonthName() {
  return new Date().toLocaleDateString("en-US", { month: "long" });
}

function streakDayLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Today on the left, then yesterday, … 6 days ago on the right */
function buildWeekDisplay(last7Days: boolean[]) {
  return Array.from({ length: 7 }, (_, i) => ({
    active: last7Days[6 - i] ?? false,
    label: streakDayLabel(i),
  }));
}

function StreakDayDot({ active, label }: { active: boolean; label: string }) {
  const isToday = label === "Today";
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
          active
            ? "bg-delulu-yellow-reserved shadow-[0_0_8px_rgba(246,195,36,0.35)]"
            : "border border-border/50 bg-secondary/80",
        )}
      >
        {active ? (
          <Flame className="h-3.5 w-3.5 text-delulu-charcoal" strokeWidth={2.5} />
        ) : null}
      </div>
      <span
        className={cn(
          "max-w-[2.75rem] text-center text-[8px] font-medium leading-tight",
          isToday ? "text-foreground" : "text-muted-foreground",
        )}
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        {label}
      </span>
    </div>
  );
}

export function HomeStreakStrip({ address }: { address: string | undefined }) {
  const { currentStreak, last7Days, activeDaysThisMonth, isLoading } =
    useUserStreak(address);

  const weekDays = useMemo(() => buildWeekDisplay(last7Days), [last7Days]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/35 bg-card/80 px-4 py-3.5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-7 w-16 rounded-lg bg-muted" />
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 w-8 rounded-full bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const showMonth = activeDaysThisMonth > 0;
  const showStartHint = currentStreak === 0;

  return (
    <Link
      href="/streaks"
      className="group block rounded-2xl border border-border/35 bg-card/80 px-4 py-3.5 transition-all hover:border-border/60 hover:bg-card active:scale-[0.995]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <Flame
            className={cn(
              "h-4 w-4 shrink-0 self-center",
              currentStreak > 0
                ? "text-delulu-yellow-reserved"
                : "text-muted-foreground/50",
            )}
            strokeWidth={2.25}
          />
          <span
            className="text-2xl font-black tabular-nums leading-none text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {currentStreak}
          </span>
          <span
            className="text-sm font-medium text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {currentStreak === 1 ? "day streak" : "days streak"}
          </span>
        </div>

        {showMonth ? (
          <p
            className="text-xs font-medium text-muted-foreground text-right"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            <span className="tabular-nums font-semibold text-foreground">
              {activeDaysThisMonth}
            </span>{" "}
            active {activeDaysThisMonth === 1 ? "day" : "days"} in{" "}
            {getMonthName()}
          </p>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-0.5">
        {weekDays.map((day, i) => (
          <StreakDayDot key={i} active={day.active} label={day.label} />
        ))}
      </div>

      {showStartHint ? (
        <p
          className="mt-2.5 text-xs text-muted-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Verify milestone proof today to start a streak
        </p>
      ) : null}
    </Link>
  );
}
