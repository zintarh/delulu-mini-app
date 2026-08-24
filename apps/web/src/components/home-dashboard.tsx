"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { HomeFeatureCarousel } from "@/components/home-feature-carousel";
// import { HomeTop10Banner } from "@/components/home-top10-banner";
import { HomeClaimNudge } from "@/components/home-claim-nudge";
// import { HomeCampaignsSection } from "@/components/home-campaigns-section";
import { HomeDailyBreakdown } from "@/components/home-daily-breakdown";
import { HomeStakesHero } from "@/components/home-stakes-hero";
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

/**
 * Rewards points, demoted from the header's primary hero slot (that's
 * HomeStakesHero's now) down to a small secondary pill next to the daily
 * activity breakdown, where "your numbers" content already lives.
 */
function HomePointsPill({ address }: { address: string }) {
  const { points, isLoading: pointsLoading } = useUserTotalPoints(address);

  return (
    <Link
      href="/rewards"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/40 bg-card/70 px-2.5 py-1 text-xs shadow-sm transition-opacity active:opacity-70"
    >
      <Star className="h-3 w-3 fill-delulu-blue/70 text-delulu-blue/70" />
      <span className="font-bold tabular-nums text-muted-foreground">
        {pointsLoading ? "—" : points.toLocaleString()}
      </span>
    </Link>
  );
}

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
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

          {/* 1. Loss aversion: visible the instant the app opens, no navigation. */}
          {address ? (
            <div className="mt-3">
              <HomeStakesHero address={address} />
            </div>
          ) : null}

          {/* 2. Today's forfeit detail — the anchor HomeStakesHero links into. */}
          <div id="forfeit-day-card" className="mb-6 mt-6 px-4">
            <ForfeitDayCard address={address} />
          </div>

          <div className="mb-4 space-y-2.5 px-4">
            <HomeClaimNudge />
          </div>

          <div className="mb-4 px-4">
            <HomeFeatureCarousel />
          </div>

          {/* Forfeit campaign banner paused for now */}
          {/* <div className="mb-4 px-4">
            <HomeTop10Banner />
          </div> */}

          {address ? (
            <div className="mb-2 flex justify-end px-4">
              <HomePointsPill address={address} />
            </div>
          ) : null}

          {address ? <HomeDailyBreakdown address={address} /> : null}

          {address ? (
            <div className="mb-6 px-4">
              <ActiveCampaignsSection address={address} heading="Active campaigns" />
            </div>
          ) : null}

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
