"use client";

import { useEffect, useState } from "react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { ForfeitDayCard } from "@/components/forfeit/forfeit-day-card";
import { LuluHero } from "@/components/home/lulu-hero";
import { HomeReadyGate } from "@/components/home/home-ready";
import { DailyMoneyCard } from "@/components/home/daily-money-card";
import { HomeCampaigns, useHomeCampaignLists } from "@/components/home/home-campaigns";
import { HomeBingo } from "@/components/home/home-bingo";
import { HomeNextStep, useHomeNextStep } from "@/components/home/home-next-step";
import { FlowStateCard } from "@/components/home/flow-state-card";
import { ReferralBanner } from "@/components/referral-banner";
import { AtStakeCard } from "@/components/home/at-stake-card";
import { HomeFirstWeek } from "@/components/home/home-first-week";
import { FirstWeekWelcome } from "@/components/home/first-week-welcome";
import { useBingoList } from "@/hooks/use-bingo";
import { HomeGreeting } from "@/components/home/home-progress";
import { cn } from "@/lib/utils";

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
  const sessionHint = hasStoredAuthSession();
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  // null until the forfeit lists load.
  const [noForfeits, setNoForfeits] = useState<boolean | null>(null);
  const campaigns = useHomeCampaignLists(address);
  const next = useHomeNextStep();
  const { bingos: homeBingos } = useBingoList();
  // New = no goals of their own and never had a Bingo card.
  const newcomer = noForfeits === true && !!homeBingos && !homeBingos.some((b) => b.me);

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
        <HomeGreeting address={address} />
        {/* New and invited players: the First Week offer comes before everything else. */}
        <HomeFirstWeek guest={!address} hidden={next?.step.kind === "first-week"} />
        {/* …and a pop-up the first time, so nobody has to find which Bingo has the welcome bonus. */}
        {address ? <FirstWeekWelcome /> : null}

        {address ? (
          <>
            {/* Lulu's card, then the referral link (the campaign that's running), then today:
                the ONE next step (hidden once the at-stake card says "done"), then money. */}
            <div className="flex flex-col gap-4">
              <LuluHero address={address} />
              <ReferralBanner address={address} />
              <HomeNextStep />
              <AtStakeCard />
              {/* Only until they've voted — after that it lives in Activity. */}
              <FlowStateCard />
              <DailyMoneyCard />
            </div>
            {/* Your own delulus — the empty "create your first" row is gone: a first
                delulu is the next step after a 7-day Bingo ("make it a habit"). */}
            <div id="forfeit-day-card">
              <ForfeitDayCard address={address} onEmptyChange={setNoForfeits} hideEmptyState />
            </div>
            <HomeBingo exclude={next?.featuredSlug ?? null} />
            {/* Missions once someone has played — a newcomer has one thing to do. */}
            {newcomer ? null : (
              <HomeCampaigns
                address={address}
                lists={noForfeits === null ? { ...campaigns, isLoading: true } : campaigns}
                noForfeits={noForfeits === true}
              />
            )}
          </>
        ) : (
          <>
            {/* Guests: the first Bingo is the way in, then missions to browse. */}
            <HomeBingo newcomer />
            <HomeCampaigns address={undefined} lists={campaigns} noForfeits />
          </>
        )}
      </div>
    </HomeReadyGate>
  );
}
