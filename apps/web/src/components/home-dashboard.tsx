"use client";

import { useEffect, useState } from "react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { HomeFeatureCarousel } from "@/components/home-feature-carousel";
// import { HomeTop10Banner } from "@/components/home-top10-banner";
// import { HomeCampaignsSection } from "@/components/home-campaigns-section";
import { HomeDailyBreakdown } from "@/components/home-daily-breakdown";
import { HomeStakesHero, useActiveForfeitStakes } from "@/components/home-stakes-hero";
import { ForfeitDayCard } from "@/components/forfeit/forfeit-day-card";
import { ActiveCampaignsSection } from "@/components/active-campaigns-section";
import { useUserStore } from "@/stores/useUserStore";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { cn } from "@/lib/utils";

/** Loss aversion owns the top-right hero slot now — just the name here. */
function HomeDashboardHeader({ name }: { name: string }) {
  return (
    <header className="px-4 pt-1">
      <h1 className="min-w-0 truncate text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
        Hi, {name}
      </h1>
    </header>
  );
}

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
}

/**
 * Everything below the header that depends on knowing whether this user has
 * anything actively at stake — split out so useActiveForfeitStakes (and the
 * points fetch) only ever run for a signed-in address, same guard pattern
 * the rest of this file already uses.
 */
function HomeSignedInFeed({ address }: { address: string }) {
  const { hasActiveStakes } = useActiveForfeitStakes(address);
  const { points, isLoading: pointsLoading } = useUserTotalPoints(address);

  return (
    <>
      {/* 1. Top cluster: onboarding carousel (also carries the claim/verify
          bar regardless of stakes) + daily breakdown right after it.
          Onboarding cards only earn their space for someone who hasn't
          actually put anything at stake yet. */}
      <div className="mb-4 mt-6 px-4">
        <HomeFeatureCarousel showOnboardingCards={!hasActiveStakes} />
      </div>
      <HomeDailyBreakdown address={address} points={points} pointsLoading={pointsLoading} />

      {/* 2. Loss aversion: visible the instant the app opens. Stays out of
          the way entirely when there's nothing at stake — ForfeitDayCard's
          own empty state already owns that CTA, no need to say it twice. */}
      <HomeStakesHero address={address} />

      {/* Forfeit campaign banner paused for now */}
      {/* <div className="mb-4 px-4">
        <HomeTop10Banner />
      </div> */}

      {/* 3. The forfeit section — Hero links here when there's something to see. */}
      <div id="forfeit-day-card" className="mb-6 px-4">
        <ForfeitDayCard address={address} />
      </div>

      {/* Active campaigns carry their own forfeit risk (forfeitPct on missed
          milestones) — grouped with the rest of "what you're on the hook for". */}
      <div className="mb-6 px-4">
        <ActiveCampaignsSection address={address} heading="Active campaigns" />
      </div>
    </>
  );
}

export function HomeDashboard({ className, onCreateClick }: HomeDashboardProps) {
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

  const awaitingAuth =
    !restoreTimedOut && (!isReady || (!authenticated && sessionHint));

  if (awaitingAuth) {
    return sessionHint ? (
      <HomeSignedInSkeleton className={className} />
    ) : (
      <HomeGuestSkeleton />
    );
  }

  return (
    <div className={cn("mx-auto w-full", className)}>
      <div
        className={cn(
          "flex flex-col",
          // Two-column grid (main feed + sticky discover rail) paused along with
          // Discover campaigns below — re-add address && "lg:grid ..." when it's back.
        )}
      >
        {/* Main feed */}
        <div className="min-w-0">
          <HomeDashboardHeader name={name} />

          {address ? (
            <HomeSignedInFeed address={address} />
          ) : (
            <>
              <div className="mb-4 mt-6 px-4">
                <HomeFeatureCarousel />
              </div>
              <div id="forfeit-day-card" className="mb-6 px-4">
                <ForfeitDayCard address={undefined} />
              </div>
            </>
          )}

          {/* Discover campaigns paused for now
          {!address ? (
            <div className="mb-6 px-4">
              <HomeCampaignsSection layout="stack" />
            </div>
          ) : null} */}
        </div>

        {/* Discover campaigns paused for now
        {address ? (
          <aside className="min-w-0 px-4 pb-6 lg:sticky lg:top-4 lg:h-[calc(100dvh-6.5rem)] lg:self-start lg:px-0 lg:pb-0">
            <HomeCampaignsSection layout="rail" />
          </aside>
        ) : null} */}
      </div>
{/*
      <OngoingMilestonesSection
        variant="home"
        hideWhenEmpty
        onCreateClick={onCreateClick}
      /> */}
    </div>
  );
}
