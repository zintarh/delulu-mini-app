"use client";

import Link from "next/link";
import { Sun, Compass, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getDailyEncouragement } from "@/lib/daily-encouragement";
import { OngoingMilestonesSection } from "@/components/ongoing-milestones-section";
import { HomeStreakStrip } from "@/components/home-streak-strip";
import { useUserEarnings } from "@/hooks/use-user-earnings";
import { formatGAmount } from "@/lib/utils";
import { cn } from "@/lib/utils";

function getTimeSalutation() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTodayLine() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function DailyEncouragement() {
  const message = getDailyEncouragement();

  return (
    <div className="rounded-2xl border border-[#f6c324]/30 bg-gradient-to-r from-[#fffbeb] to-[#fffbeb]/40 px-3.5 py-3">
      <div className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f6c324]/35 text-[#1a1a19]">
          <Sun className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a7b0a]"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Today&apos;s nudge
          </p>
          <p
            className="mt-0.5 text-[13px] font-medium leading-snug text-[#1a1a19]/90"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function HomeDashboardHeader({ address }: { address: string | undefined }) {
  const salutation = getTimeSalutation();
  const today = formatTodayLine();
  const { earningsLines, isLoading } = useUserEarnings(address);

  return (
    <header className="px-4 pt-1">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {salutation}
          </p>
          <h1
            className="mt-1 text-lg font-black leading-tight tracking-tight text-foreground sm:text-xl"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {today}
          </h1>
        </div>

        <div className="shrink-0 rounded-2xl border border-border/40 bg-card px-3 py-2.5 text-right shadow-sm">
          <div className="flex items-center justify-end gap-1 text-muted-foreground">
            <Wallet className="h-3 w-3" strokeWidth={2.25} />
            <span
              className="text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              Earned
            </span>
          </div>
          {isLoading ? (
            <div className="mt-1 h-7 w-16 animate-pulse rounded bg-muted" />
          ) : earningsLines.length === 0 ? (
            <p
              className="mt-0.5 text-lg font-black tabular-nums leading-none text-muted-foreground"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              0
            </p>
          ) : earningsLines.length === 1 ? (
            <p
              className="mt-0.5 text-lg font-black tabular-nums leading-none text-foreground"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              {formatGAmount(earningsLines[0]!.amount)}{" "}
              <span className="text-sm font-bold text-muted-foreground">
                {earningsLines[0]!.symbol}
              </span>
            </p>
          ) : (
            <div className="mt-0.5 space-y-0.5">
              {earningsLines.slice(0, 2).map((line) => (
                <p
                  key={line.symbol}
                  className="text-sm font-black tabular-nums leading-none text-foreground"
                  style={{ fontFamily: '"Clash Display", sans-serif' }}
                >
                  {formatGAmount(line.amount)}{" "}
                  <span className="text-xs font-bold text-muted-foreground">
                    {line.symbol}
                  </span>
                </p>
              ))}
            </div>
          )}
          <p
            className="mt-0.5 text-[10px] font-medium text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            all time
          </p>
        </div>
      </div>
    </header>
  );
}

function HomeGuestPrompt() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <DailyEncouragement />
      <h1
        className="mt-8 text-2xl font-black text-foreground"
        style={{ fontFamily: '"Clash Display", sans-serif' }}
      >
        Track your goals here
      </h1>
      <p
        className="mt-2 text-sm text-muted-foreground leading-relaxed"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        Sign in to see your active delulus, milestone progress, and submit proof
        from one place.
      </p>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-full bg-[#f6c324] px-6 py-3 text-sm font-black text-[#1a1a19] border-2 border-[#1a1a19] shadow-[3px_3px_0px_0px_#1a1a19] active:translate-x-px active:translate-y-px active:shadow-none"
        >
          Sign in
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted/50"
        >
          <Compass className="h-4 w-4" />
          Explore delulus
        </Link>
      </div>
    </div>
  );
}

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
}

export function HomeDashboard({ className, onCreateClick }: HomeDashboardProps) {
  const { authenticated, address } = useAuth();

  if (!authenticated) {
    return <HomeGuestPrompt />;
  }

  return (
    <div className={cn("mx-auto w-full max-w-lg", className)}>
      <HomeDashboardHeader address={address} />

      <div className="mb-4 mt-3 space-y-2.5 px-4">
        <DailyEncouragement />
        <HomeStreakStrip address={address} />
      </div>

      <OngoingMilestonesSection variant="home" onCreateClick={onCreateClick} />

      <div className="px-4 pb-4 pt-2">
        <Link
          href="/explore"
          className="flex items-center justify-center gap-2 rounded-xl border border-border/50 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Compass className="h-3.5 w-3.5" />
          Explore
        </Link>
      </div>
    </div>
  );
}
