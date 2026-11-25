"use client";

import { useEffect, useState } from "react";
import { HomeGuestSkeleton, HomeSignedInSkeleton } from "@/components/delulu-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { ForfeitDayCard } from "@/components/forfeit/forfeit-day-card";
import { LuluHero } from "@/components/home/lulu-hero";
import { HomeReadyGate } from "@/components/home/home-ready";
import { HomeBingo } from "@/components/home/home-bingo";
import { HomeBingoMini } from "@/components/home/home-bingo-mini";
import { useHomeNextStep } from "@/components/home/home-next-step";
import { HomeFirstWeek } from "@/components/home/home-first-week";
import { FirstWeekWelcome } from "@/components/home/first-week-welcome";
import { HomeWalletStrip } from "@/components/home/home-wallet-strip";
import { HomeEarnLoop } from "@/components/home/home-earn-loop";
import { useLuluHomeNews } from "@/components/home/home-lulu-news";
import { useBingoList } from "@/hooks/use-bingo";
import { HomeGreeting } from "@/components/home/home-progress";
import { cn } from "@/lib/utils";

interface HomeDashboardProps {
  className?: string;
  onCreateClick?: () => void;
}

/**
 * Home, kept short (25 Nov 2026): Lulu says the one thing to do (next step,
 * referral news) instead of a stack of cards; today's card in small; your G$
 * (balance, price, free claim, get more); how you earn in three steps; your
 * goals; Bingos in one swipeable row. Missions live in Explore.
 */
export function HomeDashboard({ className }: HomeDashboardProps) {
  const { authenticated, address, isReady } = useAuth();
  const sessionHint = hasStoredAuthSession();
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  // null until the forfeit lists load.
  const [noForfeits, setNoForfeits] = useState<boolean | null>(null);
  const next = useHomeNextStep();
  const news = useLuluHomeNews();
  const { bingos } = useBingoList();

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

  // Signed in: wait for Lulu + your G$ (they report in) and your goals. Guests: nothing to wait for.
  const pageDataReady = address ? noForfeits !== null : true;
  // Today's card, small — the one Lulu's next step is about.
  const featured = next?.featuredSlug ? (bingos?.find((b) => b.slug === next.featuredSlug && b.me) ?? null) : null;

  return (
    <HomeReadyGate
      waitFor={address ? ["lulu", "money"] : []}
      extraReady={pageDataReady}
      skeleton={address ? <HomeSignedInSkeleton className={className} /> : <HomeGuestSkeleton className={className} />}
    >
      <div className={cn("mx-auto flex w-full flex-col gap-5 px-5 pb-10 pt-3", className)}>
        <HomeGreeting address={address} />
        {/* New and invited players: the First Week offer comes before everything else. */}
        <HomeFirstWeek guest={!address} />
        {/* …and a pop-up the first time, so nobody has to find which Bingo has the welcome bonus. */}
        {address ? <FirstWeekWelcome /> : null}

        {address ? (
          <>
            <LuluHero address={address} extra={news} />
            {featured?.me ? (
              <HomeBingoMini
                card={featured.me}
                slug={featured.slug}
                title={featured.title}
                today={featured.me.dayOrdered && !featured.me.todayUsed ? featured.me.today : null}
              />
            ) : null}
            <HomeWalletStrip />
            <HomeEarnLoop />
            <div id="forfeit-day-card">
              <ForfeitDayCard address={address} onEmptyChange={setNoForfeits} hideEmptyState />
            </div>
            <HomeBingo exclude={featured?.slug ?? null} />
          </>
        ) : (
          <>
            <HomeEarnLoop />
            <HomeBingo newcomer />
          </>
        )}
      </div>
    </HomeReadyGate>
  );
}
