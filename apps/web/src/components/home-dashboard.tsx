"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Compass, Star } from "lucide-react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { HomeFeatureCarousel } from "@/components/home-feature-carousel";
import { HomeTop10Banner } from "@/components/home-top10-banner";
import { HomeClaimNudge } from "@/components/home-claim-nudge";
import { HomeCampaignsSection } from "@/components/home-campaigns-section";
import { useUserStore } from "@/stores/useUserStore";
import { useGraphUserStats } from "@/hooks/graph/useGraphUserStats";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { cn, formatGAmount } from "@/lib/utils";
import { prefetchExploreOnIntent } from "@/lib/prefetch-explore-feed";

function HomeDashboardHeader({ address }: { address: string | undefined }) {
  const user = useUserStore((s) => s.user);
  const { totalClaimed, isLoading: earnedLoading, error: earnedError } = useGraphUserStats(address);
  const { points, isLoading: pointsLoading } = useUserTotalPoints(address);
  const name = user?.username || user?.displayName || "there";
  const hasEarned = totalClaimed > 0;

  return (
    <header className="px-4 pt-1">
      <div className="flex items-center justify-between gap-3">
        <h1
          className="min-w-0 truncate text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl"
        >
          Hi, {name}
        </h1>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-card px-2.5 py-1.5 shadow-sm">
            <Star className="h-3.5 w-3.5 fill-delulu-blue text-delulu-blue" />
            <span className="text-xs font-black tabular-nums text-foreground">
              {pointsLoading ? "—" : points.toLocaleString()}
            </span>
          </div>

          <Link
            href="/wallet"
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1.5 shadow-sm transition-opacity active:opacity-70",
              hasEarned ? "bg-emerald-500/10" : "bg-muted",
            )}
          >
            <Coins
              className={cn(
                "h-3.5 w-3.5",
                hasEarned ? "text-emerald-600" : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-xs font-black tabular-nums",
                hasEarned ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {earnedLoading || earnedError ? "—" : `${formatGAmount(totalClaimed)} G$`}
            </span>
          </Link>
        </div>
      </div>
    </header>
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
    <div className={cn("mx-auto w-full ", className)}>
      <HomeDashboardHeader address={address} />

      <div className="mb-4 mt-3 px-4">
        <HomeFeatureCarousel />
      </div>

      <div className="mb-4 px-4">
        <HomeTop10Banner />
      </div>

      <div className="mb-4 space-y-2.5 px-4">
        <HomeClaimNudge />
      </div>

      <HomeCampaignsSection />
{/* 
      <OngoingMilestonesSection
        variant="home"
        hideWhenEmpty
        onCreateClick={onCreateClick}
      /> */}



      <div className="px-4 pb-4 pt-2">
        <Link
          href="/explore"
          onMouseEnter={prefetchExploreOnIntent}
          onTouchStart={prefetchExploreOnIntent}
          className="flex items-center justify-center gap-2 rounded-xl border border-border/50 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Compass className="h-3.5 w-3.5" />
          Explore
        </Link>
      </div>
    </div>
  );
}
