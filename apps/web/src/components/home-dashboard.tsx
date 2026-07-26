"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { HomeFeatureCarousel } from "@/components/home-feature-carousel";
// import { HomeTop10Banner } from "@/components/home-top10-banner";
import { HomeClaimNudge } from "@/components/home-claim-nudge";
import { HomeCampaignsSection } from "@/components/home-campaigns-section";
import { HomeDailyBreakdown } from "@/components/home-daily-breakdown";
import { ForfeitDayCard } from "@/components/forfeit/forfeit-day-card";
import { ActiveCampaignsSection } from "@/components/active-campaigns-section";
import { useUserStore } from "@/stores/useUserStore";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { cn } from "@/lib/utils";
import {
  isActiveForfeit,
  useCreatorForfeits,
  useVerifierForfeits,
} from "@/hooks/use-creator-forfeits";

function HomeDashboardHeader({ address }: { address: string | undefined }) {
  const user = useUserStore((s) => s.user);
  const { points, isLoading: pointsLoading } = useUserTotalPoints(address);
  const name = user?.username || user?.displayName || "there";

  return (
    <header className="px-4 pt-1">
      <div className="flex items-center justify-between gap-3">
        <h1
          className="min-w-0 truncate text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl"
        >
          Hi, {name}
        </h1>

        <Link
          href="/rewards"
          className="flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-card px-2.5 py-1.5 shadow-sm transition-opacity active:opacity-70"
        >
          <Star className="h-3.5 w-3.5 fill-delulu-blue text-delulu-blue" />
          <span className="text-xs font-black tabular-nums text-foreground">
            {pointsLoading ? "—" : points.toLocaleString()}
          </span>
        </Link>
      </div>
    </header>
  );
}

/** Forfeit first when you have one; otherwise active campaigns first, forfeit below.
 * Shares React Query cache with ForfeitDayCard (same keys) — no duplicate network. */
function HomeForfeitAndCampaigns({ address }: { address: string }) {
  const { data: forfeits } = useCreatorForfeits(address);
  const { data: verifyForfeits } = useVerifierForfeits(address);
  const hasForfeits = useMemo(
    () => (forfeits ?? []).some(isActiveForfeit) || (verifyForfeits ?? []).some(isActiveForfeit),
    [forfeits, verifyForfeits],
  );

  const forfeit = (
    <div className="mb-6 px-4">
      <ForfeitDayCard address={address} />
    </div>
  );

  const campaigns = (
    <div className="mb-6 px-4">
      <ActiveCampaignsSection address={address} heading="Active campaigns" />
    </div>
  );

  if (hasForfeits) {
    return (
      <>
        {forfeit}
        {campaigns}
      </>
    );
  }

  return (
    <>
      {campaigns}
      {forfeit}
    </>
  );
}

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
}

export function HomeDashboard({ className, onCreateClick }: HomeDashboardProps) {
  const { authenticated, address, isReady } = useAuth();
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
      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        {/* Main feed */}
        <div className="min-w-0">
          <HomeDashboardHeader address={address} />

          <div className="mb-4 mt-3 px-4">
            <HomeFeatureCarousel />
          </div>

          {/* $100 / 30,000 points campaign ended — banner commented out */}
          {/* <div className="mb-4 px-4">
            <HomeTop10Banner />
          </div> */}

          <div className="mb-4 space-y-2.5 px-4">
            <HomeClaimNudge />
          </div>

          {address ? <HomeDailyBreakdown address={address} /> : null}

          {address ? <HomeForfeitAndCampaigns address={address} /> : null}
        </div>

        {/* Discover campaigns: below feed on mobile, sticky side rail on desktop */}
        <aside className="min-w-0 px-4 pb-6 lg:sticky lg:top-6 lg:self-start lg:px-0 lg:pb-0">
          <HomeCampaignsSection layout="rail" />
        </aside>
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
