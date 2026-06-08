"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import {
  transformSubgraphDelulu,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { USDT_ADDRESSES } from "@/lib/constant";
import {
  batchResolveIPFS,
  getCachedContent,
  scheduleBatchResolveIPFS,
} from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

const PAGE_SIZE = 30;

const GET_DELULUS_FEED = gql`
  query GetDelulusFeed($first: Int = 30, $skip: Int = 0, $usdtToken: Bytes!) {
    delulus(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: { isCancelled: false, token: $usdtToken }
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
      milestones(first: 15, orderBy: milestoneId, orderDirection: asc) {
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
  /** Real total milestone count from the subgraph — not capped by the feed query's first:15 */
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
  usdtToken: string;
}

export function useAllDelulus() {
  const [page, setPage] = useState(0);
  const [ipfsResolved, setIpfsResolved] = useState(0);
  const [isIpfsLoading, setIsIpfsLoading] = useState(false);

  const [hasMore, setHasMore] = useState(true);

  const prevAccumulatedRef = useRef(0);
  const isFetchingMoreRef = useRef(false);

  const usdtToken = USDT_ADDRESSES.mainnet.toLowerCase();

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
      variables: { first: PAGE_SIZE, skip: 0, usdtToken },
      fetchPolicy: "cache-first",
      nextFetchPolicy: "cache-and-network",
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

  useEffect(() => {
    if (page !== 0 || loading || data?.delulus === undefined) return;
    const count = data.delulus.length;
    prevAccumulatedRef.current = count;
    setHasMore(count >= PAGE_SIZE);
  }, [page, loading, data?.delulus]);

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

    const hashes = data.delulus.map((d) => d.contentHash);
    const priorityHashes = hashes.slice(0, PAGE_SIZE);
    const deferredHashes = hashes.slice(PAGE_SIZE);

    setIsIpfsLoading(true);
    batchResolveIPFS(priorityHashes, { maxHashes: PAGE_SIZE })
      .then(() => {
        setIpfsResolved((prev) => prev + 1);
      })
      .finally(() => {
        setIsIpfsLoading(false);
      });

    if (deferredHashes.length > 0) {
      scheduleBatchResolveIPFS(deferredHashes, () => {
        setIpfsResolved((prev) => prev + 1);
      });
    }
  }, [data?.delulus]);

  const fetchNextPage = useCallback(() => {
    if (isFetchingMoreRef.current) return;
    const nextPage = page + 1;
    prevAccumulatedRef.current = data?.delulus.length ?? 0;
    isFetchingMoreRef.current = true;
    setPage(nextPage);
    fetchMore({
      variables: {
        first: PAGE_SIZE,
        skip: nextPage * PAGE_SIZE,
        usdtToken,
      },
    });
  }, [page, fetchMore, data?.delulus.length, usdtToken]);

  const refetch = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    prevAccumulatedRef.current = 0;
    isFetchingMoreRef.current = false;
    await apolloRefetch({ first: PAGE_SIZE, skip: 0, usdtToken });
  }, [apolloRefetch, usdtToken]);

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
