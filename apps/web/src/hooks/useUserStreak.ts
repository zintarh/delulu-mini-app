"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const USER_VERIFIED_MILESTONES_QUERY = gql`
  query UserVerifiedMilestones($address: String!, $nowSec: BigInt!) {
    milestones(
      first: 200
      where: {
        creator: $address
        isVerified: true
        isDeleted: false
        delulu_: { isCancelled: false, resolutionDeadline_gt: $nowSec }
      }
      orderBy: verifiedAt
      orderDirection: desc
    ) {
      id
      verifiedAt
    }
  }
`;

export interface UserStreakResult {
  currentStreak: number;
  last7Days: boolean[];
  totalVerified: number;
  isLoading: boolean;
}

function toMidnightUtc(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function useUserStreak(address: string | undefined): UserStreakResult {
  const nowSec = String(Math.floor(Date.now() / 1000));

  const { data, loading } = useQuery<{ milestones: { id: string; verifiedAt: string | null }[] }>(
    USER_VERIFIED_MILESTONES_QUERY,
    {
      variables: { address: address?.toLowerCase() ?? "", nowSec },
      skip: !address,
      fetchPolicy: "cache-and-network",
    },
  );

  return useMemo(() => {
    const milestones = data?.milestones ?? [];

    // Collect unique UTC midnight timestamps that had at least one verification
    const activeDays = new Set<number>();
    for (const m of milestones) {
      if (!m.verifiedAt) continue;
      const ts = Number(m.verifiedAt) * 1000;
      if (Number.isFinite(ts) && ts > 0) activeDays.add(toMidnightUtc(ts));
    }

    const todayUtc = toMidnightUtc(Date.now());
    const DAY_MS = 86_400_000;

    // Last 7 days array (oldest → newest, index 0 = 6 days ago, index 6 = today)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const dayMs = todayUtc - (6 - i) * DAY_MS;
      return activeDays.has(dayMs);
    });

    // Consecutive streak going backwards from today (or yesterday if today is inactive)
    let currentStreak = 0;
    let cursor = todayUtc;
    while (activeDays.has(cursor)) {
      currentStreak++;
      cursor -= DAY_MS;
    }
    // If today not yet active, check if there's a live streak ending yesterday
    if (currentStreak === 0) {
      cursor = todayUtc - DAY_MS;
      while (activeDays.has(cursor)) {
        currentStreak++;
        cursor -= DAY_MS;
      }
    }

    return {
      currentStreak,
      last7Days,
      totalVerified: milestones.length,
      isLoading: loading,
    };
  }, [data?.milestones, loading]);
}
