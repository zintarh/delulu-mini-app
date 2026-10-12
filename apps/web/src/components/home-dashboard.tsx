"use client";

import { useEffect, useState } from "react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { ForfeitDayCard } from "@/components/forfeit/forfeit-day-card";
import { DailyMoneyCard } from "@/components/home/daily-money-card";
import { StartFreeCard } from "@/components/home/start-free-card";
import { DailyGoalCard, HomeGreeting } from "@/components/home/home-progress";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
}

/**
 * Home (redesign — docs/redesign/screens/Home.dc.html): greeting, free daily
 * money, daily goal with Lulu's mood, and today's quests. The HUD (level, streak, points, alerts) lives in the
 * shared mobile top bar.
 */
export function HomeDashboard({ className }: HomeDashboardProps) {
  const { authenticated, address, isReady } = useAuth();
  const user = useUserStore((s) => s.user);
  const name = user?.username || user?.displayName || "there";
  const sessionHint = hasStoredAuthSession();
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);

  useEffect(() => {
    if (!sessionHint || authenticated) {
      setRestoreTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setRestoreTimedOut(true), 3_000);
    return () => window.clearTimeout(id);
  }, [sessionHint, authenticated]);

  const awaitingAuth = !restoreTimedOut && (!isReady || (!authenticated && sessionHint));

  if (awaitingAuth) {
    return sessionHint ? <HomeSignedInSkeleton className={className} /> : <HomeGuestSkeleton />;
  }

  return (
    <div className={cn("mx-auto flex w-full flex-col gap-4 px-5 pb-6 pt-2.5", className)}>
      <HomeGreeting name={name} address={address} />

      {address ? (
        <>
          <DailyMoneyCard />
          <StartFreeCard />
          <DailyGoalCard address={address} />
          <div id="forfeit-day-card" className="mt-2">
            <ForfeitDayCard address={address} />
          </div>
        </>
      ) : (
        <div id="forfeit-day-card">
          <ForfeitDayCard address={undefined} />
        </div>
      )}
    </div>
  );
}
