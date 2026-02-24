

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { useAccount } from "wagmi";
import {
  GetDelulusDocument,
  type GetDelulusQuery,
  type GetDelulusQueryVariables,
} from "@/generated/graphql";
import {
  transformSubgraphDelulu,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

type DeluluStatus = "ongoing" | "past";
const PAGE_SIZE = 20;

export function useGraphUserDelulus(status: DeluluStatus = "ongoing") {
  const { address, isConnected } = useAccount();
  const [page, setPage] = useState(0);
  const [allDelulus, setAllDelulus] = useState<FormattedDelulu[]>([]);
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const creatorAddress = address?.toLowerCase() ?? "";

  // Build the filter based on status tab
  const where = useMemo(() => {
    const base: Record<string, unknown> = {
      creatorAddress,
    };

    if (status === "ongoing") {
      base.isResolved = false;
      base.isCancelled = false;
    }

    return base;
  }, [creatorAddress, status]);

  const { data, loading, error, fetchMore, refetch: apolloRefetch } = useQuery<GetDelulusQuery, GetDelulusQueryVariables>(GetDelulusDocument, {
    variables: {
      first: PAGE_SIZE,
      skip: 0,
      where,
    },
    skip: !isConnected || !address,
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });



  // Transform + filter by status
  const rawDelulus = useMemo(() => {
    if (!data?.delulus) return [];

    let transformed = data.delulus.map((d) =>
      transformSubgraphDelulu(
        d as SubgraphDeluluRaw,
        getCachedContent(d.contentHash)
      )
    );

    // For "past" tab, we fetched all and need to filter client-side
    if (status === "past") {
      transformed = transformed.filter((d) => d.isResolved || d.isCancelled);
    }

    return transformed;
  }, [data?.delulus, status, ipfsResolved]);

  // Resolve IPFS content
  useEffect(() => {
    if (!data?.delulus || data.delulus.length === 0) return;
    const hashes = data.delulus.map((d) => d.contentHash);
    batchResolveIPFS(hashes).then(() => {
      setIpfsResolved((prev) => prev + 1);
    });
  }, [data?.delulus]);

  // Accumulate across pages
  useEffect(() => {
    if (rawDelulus.length === 0 && page === 0) {
      setAllDelulus([]);
      return;
    }
    if (rawDelulus.length === 0) return;

    setAllDelulus((prev) => {
      if (page === 0) return rawDelulus;
      const seenIds = new Set(prev.map((d) => d.onChainId || `${d.id}`));
      const newItems = rawDelulus.filter(
        (d) => !seenIds.has(d.onChainId || `${d.id}`)
      );
      return [...prev, ...newItems];
    });
  }, [rawDelulus, page]);

  // Reset when status changes
  useEffect(() => {
    setPage(0);
    setAllDelulus([]);
  }, [status, address]);

  const fetchNextPage = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMore({
      variables: { skip: nextPage * PAGE_SIZE, first: PAGE_SIZE },
    });
  }, [page, fetchMore]);

  const refetch = useCallback(() => {
    setPage(0);
    setAllDelulus([]);
    apolloRefetch({
      first: PAGE_SIZE,
      skip: 0,
      where,
    });
  }, [apolloRefetch, where]);

  const hasNextPage =
    data?.delulus !== undefined && data.delulus.length === PAGE_SIZE;

  return {
    delulus: allDelulus,
    isLoading: loading && page === 0,
    isFetchingNextPage: loading && page > 0,
    hasNextPage,
    fetchNextPage,
    error: error ?? null,
    refetch,
  };
}
