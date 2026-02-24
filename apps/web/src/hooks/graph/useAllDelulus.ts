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
  const [allDelulus, setAllDelulus] = useState<FormattedDelulu[]>([]);
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const { data, loading, error, fetchMore, refetch: apolloRefetch } = useQuery<
    GetDelulusQuery,
    GetDelulusQueryVariables
  >(GetDelulusDocument, {
    variables: {
      first: PAGE_SIZE,
      skip: 0,
    },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const rawDelulus = useMemo(() => {
    if (!data?.delulus || data.delulus.length === 0) {
      return [];
    }

    try {
      return data.delulus
        .map((d) => {
          try {
            const cached = getCachedContent(d.contentHash);
            return transformSubgraphDelulu(d as SubgraphDeluluRaw, cached);
          } catch {
            return null;
          }
        })
        .filter((d): d is FormattedDelulu => d !== null)
        .filter((d) => !d.isCancelled);
    } catch {
      return [];
    }
  }, [data?.delulus, ipfsResolved]);

  // Accumulate delulus across pages
  useEffect(() => {
    if (page === 0) {
      // First page - replace all
      setAllDelulus(rawDelulus);
    } else {
      // Pagination - append new items
      setAllDelulus((prev) => {
        const seenIds = new Set(prev.map((d) => d.onChainId || `${d.id}`));
        const newItems = rawDelulus.filter(
          (d) => !seenIds.has(d.onChainId || `${d.id}`)
        );
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    }
  }, [rawDelulus, page]);




  useEffect(() => {
    if (!data?.delulus || data.delulus.length === 0) return;
    const hashes = data.delulus.map((d) => d.contentHash);
    batchResolveIPFS(hashes).then(() => {
      setIpfsResolved((prev) => prev + 1);
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

  const refetch = useCallback(() => {
    setPage(0);
    setAllDelulus([]);
    apolloRefetch();
  }, [apolloRefetch]);

  const hasNextPage = data?.delulus !== undefined && data.delulus.length === PAGE_SIZE;

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
