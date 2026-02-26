"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@apollo/client/react";
import {
  GetDelulusDocument,
  type GetDelulusQuery,
  type GetDelulusQueryVariables,
} from "@/generated/graphql";
import {
  transformSubgraphDelulu,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import {
  batchResolveIPFS,
  getCachedContent,
} from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

const PAGE_SIZE = 20;

export function useAllDelulus() {
  const [page, setPage] = useState(0);
  const [ipfsResolved, setIpfsResolved] = useState(0);
  const [isIpfsLoading, setIsIpfsLoading] = useState(false);

  const { data, loading, error, fetchMore, refetch: apolloRefetch, previousData } = useQuery<
    GetDelulusQuery,
    GetDelulusQueryVariables
  >(GetDelulusDocument, {
    variables: {
      first: PAGE_SIZE,
      skip: 0,
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // Use current data, or fallback to previousData while loading to prevent flickering
  const displayData = data?.delulus || previousData?.delulus || [];

  const delulus = useMemo(() => {
    if (displayData.length === 0) return [];

    return displayData
      .map((d) => {
        try {
          const cached = getCachedContent(d.contentHash);
          return transformSubgraphDelulu(d as SubgraphDeluluRaw, cached);
        } catch {
          return null;
        }
      })
      .filter((d): d is FormattedDelulu => d !== null && !d.isCancelled);
  }, [displayData, ipfsResolved]);

  // IPFS Resolution Logic
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
        skip: nextPage * PAGE_SIZE,
      },
    });
  }, [page, fetchMore]);

  const refetch = useCallback(async () => {
    setPage(0);
    await apolloRefetch({ first: PAGE_SIZE, skip: 0 });
  }, [apolloRefetch]);

  const hasNextPage = data?.delulus !== undefined && data.delulus.length >= PAGE_SIZE;

  return {
    delulus, // Now always stable
    isLoading: loading && !data && !previousData, // Only true on absolute first load
    isFetchingNextPage: loading && page > 0,
    isIpfsLoading,
    hasNextPage,
    fetchNextPage,
    error: error ?? null,
    refetch,
  };
}