

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/hooks/use-auth";
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
const PAST_FETCH_SIZE = 100;

export function useGraphUserDelulus(status: DeluluStatus = "ongoing") {
  const { address } = useAuth();
  const [page, setPage] = useState(0);
  const [allDelulus, setAllDelulus] = useState<FormattedDelulu[]>([]);
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const creatorAddressVariants = useMemo(() => {
    if (!address) return [] as string[];
    return Array.from(new Set([address, address.toLowerCase()]));
  }, [address]);

  // For "ongoing": filter resolved/cancelled at subgraph level for efficiency.
  // For "past": fetch a large batch (no subgraph filter) so older resolved ones aren't cut off by page size.
  const where = useMemo(() => {
    if (status === "ongoing") {
      return {
        creatorAddress_in: creatorAddressVariants,
        isResolved: false,
        isCancelled: false,
      } as Record<string, unknown>;
    }
    return { creatorAddress_in: creatorAddressVariants } as Record<string, unknown>;
  }, [creatorAddressVariants, status]);

  const fetchSize = status === "past" ? PAST_FETCH_SIZE : PAGE_SIZE;

  const { data, loading, error, fetchMore, refetch: apolloRefetch } = useQuery<GetDelulusQuery, GetDelulusQueryVariables>(GetDelulusDocument, {
    variables: {
      first: fetchSize,
      skip: 0,
      where,
    },
    skip: !address,
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });



  // Transform + filter by status tab.
  const rawDelulus = useMemo(() => {
    if (!data?.delulus) return [];

    const transformed = data.delulus.map((d) =>
      transformSubgraphDelulu(
        d as SubgraphDeluluRaw,
        getCachedContent(d.contentHash)
      )
    );

    const now = Date.now();
    return transformed.filter((d) => {
      const endMs = d.resolutionDeadline?.getTime?.() ?? 0;
      const hasValidEnd = Number.isFinite(endMs) && endMs > 0;
      const endedByTime = hasValidEnd ? endMs <= now : false;
      const isPast = d.isResolved || d.isCancelled || endedByTime;
      return status === "past" ? isPast : !isPast;
    });
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
      variables: { skip: nextPage * fetchSize, first: fetchSize },
    });
  }, [page, fetchMore, fetchSize]);

  const refetch = useCallback(() => {
    setPage(0);
    setAllDelulus([]);
    apolloRefetch({
      first: fetchSize,
      skip: 0,
      where,
    });
  }, [apolloRefetch, where, fetchSize]);

  const hasNextPage =
    data?.delulus !== undefined && data.delulus.length === fetchSize;

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
