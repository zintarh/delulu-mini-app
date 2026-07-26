"use client";

import { ForfeitDayCard } from "@/components/forfeit/forfeit-day-card";

/** Profile Forfeit tab — day card only (no separate promo banner when empty). */
export function ProfileForfeitSection({ address }: { address: string }) {
  return <ForfeitDayCard address={address} />;
}
