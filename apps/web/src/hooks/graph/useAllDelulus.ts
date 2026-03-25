"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import {
  transformSubgraphDelulu,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import {
  batchResolveIPFS,
  getCachedContent,
} from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

const PAGE_SIZE = 10;

const GET_DELULUS_FEED = gql`
  query GetDelulusFeed($first: Int = 10, $skip: Int = 0) {
    delulus(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: { isCancelled: false }
    ) {
      id
      onChainId
      token
      creator {
        id
        username
      }
      creatorAddress
      contentHash
      stakingDeadline
      resolutionDeadline
      createdAt
      creatorStake
      totalSupportCollected
      totalSupporters
      challengeId
      isResolved
      isCancelled
      milestones(first: 3, orderBy: milestoneId, orderDirection: asc) {
        milestoneId
        milestoneURI
        deadline
        startTime
        isSubmitted
        isVerified
      }
    }
  }
`;

interface FeedMilestoneRaw {
  milestoneId: string;
  milestoneURI?: string | null;
  deadline: string;
  startTime?: string | null;
  isSubmitted: boolean;
  isVerified: boolean;
}

export interface FeedMilestone {
  milestoneId: string;
  milestoneURI?: string | null;
  deadline: Date;
  startTime: Date | null;
  isSubmitted: boolean;
  isVerified: boolean;
}

export type FormattedDeluluFeed = FormattedDelulu & {
  feedMilestones?: FeedMilestone[];
};

type FeedDelulu = Pick<
  SubgraphDeluluRaw,
  | "id"
  | "onChainId"
  | "token"
  | "creatorAddress"
  | "contentHash"
  | "stakingDeadline"
  | "resolutionDeadline"
  | "createdAt"
  | "creatorStake"
  | "totalSupportCollected"
  | "totalSupporters"
  | "challengeId"
  | "isResolved"
  | "isCancelled"
  | "creator"
>;
type FeedDeluluWithMilestones = FeedDelulu & {
  milestones?: FeedMilestoneRaw[];
};

interface GetDelulusFeedQuery {
  delulus: FeedDelulu[];
}

interface GetDelulusFeedQueryVariables {
  first?: number;
  skip?: number;
}

export function useAllDelulus() {
  const [page, setPage] = useState(0);
  const [ipfsResolved, setIpfsResolved] = useState(0);
  const [isIpfsLoading, setIsIpfsLoading] = useState(false);

  const { data, loading, error, fetchMore, refetch: apolloRefetch, previousData } = useQuery<
    GetDelulusFeedQuery,
    GetDelulusFeedQueryVariables
  >(GET_DELULUS_FEED, {
    variables: {
      first: PAGE_SIZE,
      skip: 0,
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const displayData = data?.delulus || previousData?.delulus || [];

  const delulus = useMemo<FormattedDeluluFeed[]>(() => {
    if (displayData.length === 0) return [];

    return displayData
      .map((d) => {
        try {
          const cached = getCachedContent(d.contentHash);
          const transformed = transformSubgraphDelulu(
            d as SubgraphDeluluRaw,
            cached,
          );
          const raw = d as FeedDeluluWithMilestones;
          const feedMilestones =
            raw.milestones?.map((m) => ({
              milestoneId: m.milestoneId,
              milestoneURI: m.milestoneURI ?? null,
              deadline: timestampToDate(m.deadline),
              startTime: m.startTime ? timestampToDate(m.startTime) : null,
              isSubmitted: m.isSubmitted,
              isVerified: m.isVerified,
            })) ?? [];

          return {
            ...transformed,
            feedMilestones,
          } as FormattedDeluluFeed;
        } catch {
          return null;
        }
      })
      .filter((d): d is FormattedDeluluFeed => d !== null && !d.isCancelled);
  }, [displayData, ipfsResolved]);



  useEffect(() => {
    if (!data?.delulus || data.delulus.length === 0) return;

    setIsIpfsLoading(true);
    const hashes = data.delulus.map((d) => d.contentHash);
    batchResolveIPFS(hashes)
      .then(() => {
        setIpfsResolved((prev) => prev + 1);
      })
      .finally(() => {
        setIsIpfsLoading(false);
      });
  }, [data?.delulus]);

  const fetchNextPage = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMore({
      variables: {
        first: PAGE_SIZE,
        skip: nextPage * PAGE_SIZE,
      },
    });
  }, [page, fetchMore]);

  const refetch = useCallback(async () => {
    setPage(0);
    await apolloRefetch({ first: PAGE_SIZE, skip: 0 });
  }, [apolloRefetch]);

  const hasNextPage =
    data?.delulus !== undefined &&
    data.delulus.length >= (page + 1) * PAGE_SIZE;

  return {
    delulus,
    isLoading: loading && !data && !previousData, 
    isFetchingNextPage: loading && page > 0,
    isIpfsLoading,
    hasNextPage,
    fetchNextPage,
    error: error ?? null,
    refetch,
  };
}