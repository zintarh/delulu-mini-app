"use client";

import { useState, useEffect, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/hooks/use-auth";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";

export type WrapPeriod = "week" | "month";

// Custom query — includes milestone detail fields not in GetDelulusDocument
const GET_USER_WRAP = gql`
  query GetUserWrap($where: Delulu_filter) {
    delulus(
      first: 1000
      orderBy: createdAt
      orderDirection: desc
      where: $where
    ) {
      id
      onChainId
      contentHash
      createdAt
      milestoneCount
      isResolved
      isCancelled
      totalSupportCollected
      totalSupporters
      creatorStake
      points
      milestones(first: 50, orderBy: milestoneId, orderDirection: asc) {
        milestoneId
        isSubmitted
        isVerified
        isMissed
        pointsEarned
      }
    }
  }
`;

interface RawMilestone {
  milestoneId: string;
  isSubmitted: boolean;
  isVerified: boolean;
  isMissed: boolean;
  pointsEarned: string;
}

interface RawDeluluWrap {
  id: string;
  onChainId: string;
  contentHash: string;
  createdAt: string;
  milestoneCount: string;
  isResolved: boolean;
  isCancelled: boolean;
  totalSupportCollected?: string;
  totalSupporters?: string;
  creatorStake?: string;
  points?: string;
  milestones?: RawMilestone[];
}

interface GetUserWrapQuery {
  delulus: RawDeluluWrap[];
}

export interface WrapStats {
  delulusCount: number;
  resolvedCount: number;
  milestonesAchieved: number;
  totalMilestones: number;
  completionRate: number;
  totalPointsEarned: number;
  totalSupporters: number;
  deluluTitles: string[];
  isLoading: boolean;
  error: Error | null;
}

export function useUserWrapStats(period: WrapPeriod | null): WrapStats {
  const { address } = useAuth();
  const [ipfsResolved, setIpfsResolved] = useState(0);

  // Exact same address variant pattern as useGraphUserDelulus
  const creatorAddressVariants = useMemo(() => {
    if (!address) return [] as string[];
    return Array.from(new Set([address, address.toLowerCase()]));
  }, [address]);

  const since = useMemo(() => {
    if (!period) return null;
    const days = period === "week" ? 7 : 30;
    return String(Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000));
  }, [period]);

  const where = useMemo(() => {
    const base: Record<string, unknown> = {
      creatorAddress_in: creatorAddressVariants,
    };
    if (since) base.createdAt_gte = since;
    return base;
  }, [creatorAddressVariants, since]);

  const { data, loading, error } = useQuery<GetUserWrapQuery>(GET_USER_WRAP, {
    variables: { where },
    skip: !address || !period,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!data?.delulus?.length) return;
    const hashes = data.delulus.map((d) => d.contentHash);
    batchResolveIPFS(hashes).then(() => setIpfsResolved((n) => n + 1));
  }, [data?.delulus]);

  const stats = useMemo(() => {
    const delulus = data?.delulus ?? [];
    let milestonesAchieved = 0;
    let totalMilestones = 0;
    let totalPointsEarned = 0;
    let totalSupporters = 0;
    let resolvedCount = 0;

    for (const d of delulus) {
      if (d.isResolved) resolvedCount++;
      const milestones = d.milestones ?? [];
      totalMilestones += milestones.length;
      if (d.points) totalPointsEarned += Number(d.points) || 0;
      for (const m of milestones) {
        if (m.isVerified) milestonesAchieved++;
      }
      if (d.totalSupporters) totalSupporters += Number(d.totalSupporters);
    }

    const deluluTitles = delulus
      .map((d) => getCachedContent(d.contentHash)?.text ?? "")
      .filter(Boolean)
      .slice(0, 5);

    return {
      delulusCount: delulus.length,
      resolvedCount,
      milestonesAchieved,
      totalMilestones,
      completionRate:
        totalMilestones > 0
          ? Math.round((milestonesAchieved / totalMilestones) * 100)
          : 0,
      totalPointsEarned,
      totalSupporters,
      deluluTitles,
    };
  }, [data?.delulus, ipfsResolved]);

  return {
    ...stats,
    isLoading: loading && !data,
    error: error ?? null,
  };
}
