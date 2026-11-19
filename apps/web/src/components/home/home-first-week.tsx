"use client";

import { FirstWeekOffer } from "@/components/first-week-offer";
import { useBingoList } from "@/hooks/use-bingo";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";

/**
 * Top of Home: the First Week offer for anyone who can still take it — the
 * Bingo list only includes it for new and invited players — and for guests
 * (everyone signing up is new). Hidden while their First Week card runs.
 */
export function HomeFirstWeek({ guest = false, hidden = false }: { guest?: boolean; /** Already shown as "Your next step". */ hidden?: boolean }) {
  const { bingos } = useBingoList();
  if (guest) return <FirstWeekOffer variant="home" href="/sign-in" />;
  if (hidden) return null;
  // Only listed for eligible players; joinable = not running one and not finished it.
  const fw = bingos?.find((b) => b.slug === FIRST_WEEK_SLUG);
  if (!fw?.joinable) return null;
  return <FirstWeekOffer variant="home" href={`/bingo/${FIRST_WEEK_SLUG}`} />;
}
