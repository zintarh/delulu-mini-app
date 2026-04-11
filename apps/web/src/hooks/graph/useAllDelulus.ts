"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
      milestoneCount
      milestones(first: 50, orderBy: milestoneId, orderDirection: asc) {
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
  /** Real total milestone count from the subgraph — not capped by the feed query's first:3 */
  totalMilestoneCount?: number;
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
  milestoneCount?: number;
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

  // Track pagination end using real per-page item counts, not heuristics.
  // hasMore starts true (optimistic) and is set to false when a page returns
  // fewer than PAGE_SIZE items — meaning the subgraph has no more data.
  const [hasMore, setHasMore] = useState(true);

  // Accumulated item count before the most recent fetchMore, used to compute
  // how many items the last page returned (newTotal - prevTotal).
  const prevAccumulatedRef = useRef(0);
  // Guards against double-triggering the post-fetch effect.
  const isFetchingMoreRef = useRef(false);

  const {
    data,
    loading,
    error,
    fetchMore,
    refetch: apolloRefetch,
    previousData,
    networkStatus,
  } = useQuery<GetDelulusFeedQuery, GetDelulusFeedQueryVariables>(
    GET_DELULUS_FEED,
    {
      variables: { first: PAGE_SIZE, skip: 0 },
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    }
  );

  const displayData = data?.delulus || previousData?.delulus || [];
  const isInitialLoading =
    (loading || networkStatus === 1) && page === 0 && displayData.length === 0;

  const delulus = useMemo<FormattedDeluluFeed[]>(() => {
    if (displayData.length === 0) return [];

    return displayData
      .map((d) => {
        try {
          const cached = getCachedContent(d.contentHash);
          const transformed = transformSubgraphDelulu(
            d as SubgraphDeluluRaw,
            cached
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
            totalMilestoneCount: raw.milestoneCount ?? feedMilestones.length,
          } as FormattedDeluluFeed;
        } catch {
          return null;
        }
      })
      .filter((d): d is FormattedDeluluFeed => d !== null && !d.isCancelled);
  }, [displayData, ipfsResolved]);

  // After the initial page loads, set hasMore based on whether we got a full page.
  useEffect(() => {
    if (page !== 0 || loading || data?.delulus === undefined) return;
    const count = data.delulus.length;
    prevAccumulatedRef.current = count;
    setHasMore(count >= PAGE_SIZE);
  }, [page, loading, data?.delulus]);

  // After a fetchMore completes (loading flips to false while isFetchingMoreRef
  // is set), check how many new items arrived from the subgraph.
  // If fewer than PAGE_SIZE, the subgraph has no more pages.
  useEffect(() => {
    if (!isFetchingMoreRef.current || loading) return;

    const newTotal = data?.delulus.length ?? 0;
    const pageItems = newTotal - prevAccumulatedRef.current;

    setHasMore(pageItems >= PAGE_SIZE);
    prevAccumulatedRef.current = newTotal;
    isFetchingMoreRef.current = false;
  }, [data?.delulus.length, loading]);

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
    if (isFetchingMoreRef.current) return;
    const nextPage = page + 1;
    // Snapshot current accumulated count before the fetch.
    prevAccumulatedRef.current = data?.delulus.length ?? 0;
    isFetchingMoreRef.current = true;
    setPage(nextPage);
    fetchMore({
      variables: {
        first: PAGE_SIZE,
        skip: nextPage * PAGE_SIZE,
      },
    });
  }, [page, fetchMore, data?.delulus.length]);

  const refetch = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    prevAccumulatedRef.current = 0;
    isFetchingMoreRef.current = false;
    await apolloRefetch({ first: PAGE_SIZE, skip: 0 });
  }, [apolloRefetch]);

  return {
    delulus,
    isLoading: isInitialLoading,
    isFetchingNextPage: loading && page > 0,
    isIpfsLoading,
    hasNextPage: hasMore,
    fetchNextPage,
    error: error ?? null,
    refetch,
  };
}
