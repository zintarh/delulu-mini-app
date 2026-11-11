"use client";

import { useEffect, useState } from "react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { ForfeitDayCard } from "@/components/forfeit/forfeit-day-card";
import { AddToHomeCard } from "@/components/home/add-to-home-card";
import { LuluHero } from "@/components/home/lulu-hero";
import { HomeReadyGate } from "@/components/home/home-ready";
import { DailyMoneyCard } from "@/components/home/daily-money-card";
import { HomeCampaigns, useHomeCampaignLists } from "@/components/home/home-campaigns";
import { StartFreeCard } from "@/components/home/start-free-card";
import { HomeGreeting } from "@/components/home/home-progress";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";
import { HowToEarnLink } from "@/components/home/how-to-earn-link";

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
}

/**
 * Home (redesign — docs/redesign/screens/Home.dc.html): greeting, free daily
 * money, daily goal with Lulu's mood, today's quests, then campaigns (see
 * HomeCampaigns for which ones). The HUD (level, streak, points, alerts) lives in the
 * shared mobile top bar.
 */
export function HomeDashboard({ className }: HomeDashboardProps) {
  const { authenticated, address, isReady } = useAuth();
  const user = useUserStore((s) => s.user);
  const name = user?.username || user?.displayName || "";
  const sessionHint = hasStoredAuthSession();
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  // null until the forfeit lists load.
  const [noForfeits, setNoForfeits] = useState<boolean | null>(null);
  const campaigns = useHomeCampaignLists(address);

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

  // Signed in: wait for Lulu + daily money (they report in) and for forfeits + campaigns (known here).
  // Guests: just campaigns. Either way one skeleton, then the whole page at once.
  const pageDataReady = address ? noForfeits !== null && !campaigns.isLoading : !campaigns.isLoading;

  return (
    <HomeReadyGate
      waitFor={address ? ["lulu", "money"] : []}
      extraReady={pageDataReady}
      skeleton={address ? <HomeSignedInSkeleton className={className} /> : <HomeGuestSkeleton className={className} />}
    >
      <div className={cn("mx-auto flex w-full flex-col gap-10 px-5 pb-10 pt-3", className)}>
        <HomeGreeting name={name} address={address} />

        {address ? (
          <>
            {/* Today at a glance — Lulu leads (progress, what matters now, what a miss costs),
                money sits right under it; sections below get the bigger gap. */}
            <div className="flex flex-col gap-4">
              <LuluHero address={address} />
              <DailyMoneyCard />
              <StartFreeCard />
              <HowToEarnLink />
            </div>
            {/* Always above campaigns: your own delulus first, or — with none yet —
                the compact "New here? Create your first delulu" row. */}
            <div id="forfeit-day-card">
              <ForfeitDayCard address={address} onEmptyChange={setNoForfeits} />
            </div>
            {/* Hold campaigns until forfeits are known too: how many to show depends on it. */}
            <HomeCampaigns
              address={address}
              lists={noForfeits === null ? { ...campaigns, isLoading: true } : campaigns}
              noForfeits={noForfeits === true}
            />
            <AddToHomeCard />
          </>
        ) : (
          <>
            {/* Guests: how earning works, "New here? Create your first delulu", then campaigns. */}
            <div className="flex flex-col gap-4">
              <HowToEarnLink />
              <div id="forfeit-day-card">
                <ForfeitDayCard address={undefined} />
              </div>
            </div>
            <HomeCampaigns address={undefined} lists={campaigns} noForfeits />
          </>
        )}
      </div>
    </HomeReadyGate>
  );
}
