"use client";

import { FirstWeekOffer } from "@/components/first-week-offer";
import { useAuth } from "@/hooks/use-auth";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { buildSignInUrl } from "@/lib/auth-redirect";

/**
 * Top of Home: the four 100 G$ cards. Guests (they have no points yet) and
 * signed-in players who have never earned a point. Anyone with points skips it.
 */
export function HomeFirstWeek({ guest = false, hidden = false }: { guest?: boolean; hidden?: boolean }) {
  const { address } = useAuth();
  const { points, isLoading } = useUserTotalPoints(guest ? undefined : address);
  if (hidden) return null;
  if (guest) return <FirstWeekOffer variant="home" href={buildSignInUrl("/play")} />;
  if (!address || isLoading || points > 0) return null;
  return <FirstWeekOffer variant="home" href="/play" />;
}
