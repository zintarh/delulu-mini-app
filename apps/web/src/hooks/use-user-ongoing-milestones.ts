"use client";

import { useMemo, useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/hooks/use-auth";
import {
  transformSubgraphDelulu,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";
import {
  getMilestoneEndTimeMs,
  getMilestoneLabel,
  getDeluluCreatedAtMs,
} from "@/lib/milestone-utils";

export interface OngoingMilestone {
  /** Stable key for React */
  key: string;
  milestoneId: string;
  label: string;
  deadline: Date;
  endTimeMs: number;
  startTime: Date | null;
  isSubmitted: boolean;
  isVerified: boolean;
  isMissed: boolean;
  delulu: FormattedDelulu;
  /** Numeric delulu id used for the contract call */
  deluluNumericId: number;
}

const GET_USER_ONGOING_DELULUS_WITH_MILESTONES = gql`
  query GetUserOngoingDelulusWithMilestones($creatorAddress: String!, $first: Int!) {
    delulus(
      where: { creatorAddress_nocase: $creatorAddress, isResolved: false, isCancelled: false }
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      onChainId
      token
      creatorAddress
      contentHash
      stakingDeadline
      resolutionDeadline
      createdAt
      creatorStake
      totalSupportCollected
      totalSupporters
      challengeId
      points
      milestoneCount
      isResolved
      isCancelled
      rewardClaimed
      creator {
        id
      }
      milestones(first: 20, orderBy: milestoneId, orderDirection: asc, where: { isDeleted: false }) {
        id
        milestoneId
        milestoneURI
        deadline
        startTime
        isSubmitted
        isVerified
        isMissed
      }
    }
  }
`;

interface OngoingMilestoneRaw {
  id: string;
  milestoneId: string;
  milestoneURI?: string | null;
  deadline: string;
  startTime?: string | null;
  isSubmitted: boolean;
  isVerified: boolean;
  isMissed: boolean;
}

interface OngoingDeluluRaw extends SubgraphDeluluRaw {
  milestones?: OngoingMilestoneRaw[];
}

interface GetUserOngoingDelulusWithMilestonesData {
  delulus: OngoingDeluluRaw[];
}

interface GetUserOngoingDelulusWithMilestonesVars {
  creatorAddress: string;
  first: number;
}

export function useUserOngoingMilestones() {
  const { address } = useAuth();
  const creatorAddress = address?.toLowerCase() ?? "";
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const { data, loading, error, refetch } = useQuery<
    GetUserOngoingDelulusWithMilestonesData,
    GetUserOngoingDelulusWithMilestonesVars
  >(
    GET_USER_ONGOING_DELULUS_WITH_MILESTONES,
    {
      variables: { creatorAddress, first: 50 },
      skip: !address,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  useEffect(() => {
    if (!data?.delulus?.length) return;
    const hashes = data.delulus.map((d: any) => d.contentHash).filter(Boolean);
    batchResolveIPFS(hashes).then(() => setIpfsResolved((p) => p + 1));
  }, [data?.delulus]);

  const milestones: OngoingMilestone[] = useMemo(() => {
    if (!data?.delulus) return [];
    const now = Date.now();
    const result: OngoingMilestone[] = [];

    for (const raw of data.delulus) {
      const delulu = transformSubgraphDelulu(
        raw as SubgraphDeluluRaw,
        getCachedContent(raw.contentHash),
      );

      // Skip if the whole delulu has ended by time (resolutionDeadline passed)
      const resolutionMs = delulu.resolutionDeadline?.getTime?.() ?? 0;
      if (resolutionMs > 0 && resolutionMs <= now) continue;

      const rawMilestones: any[] = raw.milestones ?? [];
      if (rawMilestones.length === 0) continue;

      const sorted = [...rawMilestones].sort(
        (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
      );

      const deluluCreatedAtMs = getDeluluCreatedAtMs(
        { createdAt: delulu.createdAt, stakingDeadline: delulu.stakingDeadline },
        now,
      );

      let prevEnd: number | null = null;
      for (const m of sorted) {
        const deadline = timestampToDate(m.deadline);
        const startTime = m.startTime ? timestampToDate(m.startTime) : null;
        const endTimeMs = getMilestoneEndTimeMs(
          { startTime, deadline },
          prevEnd,
          deluluCreatedAtMs,
        );
        prevEnd = endTimeMs;

        // Include active milestones and those under review (submitted but not verified).
        if (endTimeMs <= now) continue;
        if (m.isVerified) continue;
        if (m.isMissed) continue;

        result.push({
          key: `${raw.id}-${m.milestoneId}`,
          milestoneId: m.milestoneId,
          label: getMilestoneLabel(
            { milestoneId: m.milestoneId, milestoneURI: m.milestoneURI },
            80,
          ),
          deadline,
          endTimeMs,
          startTime,
          isSubmitted: m.isSubmitted,
          isVerified: m.isVerified,
          isMissed: m.isMissed,
          delulu,
          deluluNumericId: delulu.id,
        });
      }
    }

    // Sort by soonest deadline first
    result.sort((a, b) => a.endTimeMs - b.endTimeMs);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.delulus, ipfsResolved]);

  return {
    milestones,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
