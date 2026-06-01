"use client";

import { useState, useEffect, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { getActiveCampaignWindow } from "@/lib/campaign-window";
import { weiToNumber } from "@/lib/graph/transformers";
import {
  batchResolveIPFS,
  getCachedContent,
  hasContentResolved,
} from "@/lib/graph/ipfs-cache";

const DELULU_LEADERBOARD_QUERY = gql`
  query DeluluLeaderboard($first: Int = 50, $skip: Int = 0, $campaignStart: BigInt = "0", $campaignEnd: BigInt = "9999999999") {
    delulus(
      first: $first
      skip: $skip
      orderBy: points
      orderDirection: desc
      where: { isCancelled: false, createdAt_gte: $campaignStart, createdAt_lte: $campaignEnd }
    ) {
      id
      onChainId
      contentHash
      creatorStake
      totalSupportCollected
      points
      tradeCount
      uniqueBuyerCount
      createdAt
      shareTrades(first: 500, orderBy: createdAt, orderDirection: asc) {
        isBuy
        curveAmount
      }
      creator {
        id
        username
      }
    }
  }
`;

export interface DeluluLeaderboardEntry {
  id: string;
  onChainId: string;
  contentHash: string;
  title: string | null;
  /** True while manifest metadata for this row is still loading */
  titleLoading: boolean;
  bgImageUrl: string | null;
  creatorAddress: string;
  creatorUsername: string | null;
  /** creatorStake + support + net G$ from bonding curve share trades */
  totalG: number;
  creatorStake: number;
  totalSupportCollected: number;
  /** Campaign points (subgraph `delulu.points`) */
  points: number;
  tradeCount: number;
  uniqueBuyerCount: number;
}

function pickManifestTitle(
  cached: ReturnType<typeof getCachedContent>,
): string | null {
  const text = cached?.text?.trim();
  if (text) return text;
  const legacy = cached?.content?.trim();
  if (legacy) return legacy;
  return null;
}

export function useDeluluLeaderboard(pageSize: number = 10, page: number = 0) {
  const [ipfsResolved, setIpfsResolved] = useState(0);
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string | null>>(
    {},
  );
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  const { campaignStart, campaignEnd, campaignEndDate } = useMemo(
    () => getActiveCampaignWindow(),
    [],
  );

  const fetchSize = Math.max(50, (page + 1) * pageSize + pageSize);

  const { data, loading, error, refetch } = useQuery<
    { delulus: any[] },
    { first: number; skip: number; campaignStart: string; campaignEnd: string }
  >(DELULU_LEADERBOARD_QUERY, {
    variables: { first: fetchSize, skip: 0, campaignStart, campaignEnd },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!data?.delulus?.length) return;
    const hashes = data.delulus.map((d) => d.contentHash).filter(Boolean);
    let cancelled = false;
    setMetadataLoaded(false);
    void batchResolveIPFS(hashes).then(() => {
      if (!cancelled) {
        setIpfsResolved((n) => n + 1);
        setMetadataLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data?.delulus]);

  useEffect(() => {
    if (!data?.delulus?.length) {
      setTitleOverrides({});
      return;
    }
    const onChainIds = [
      ...new Set(data.delulus.map((d) => String(d.onChainId)).filter(Boolean)),
    ];
    if (onChainIds.length === 0) return;

    let cancelled = false;
    void fetch(
      `/api/goals/metadata/batch?onChainIds=${encodeURIComponent(onChainIds.join(","))}`,
    )
      .then((res) => (res.ok ? res.json() : { titles: {} }))
      .then((body: { titles?: Record<string, string | null> }) => {
        if (!cancelled) setTitleOverrides(body.titles ?? {});
      })
      .catch(() => {
        if (!cancelled) setTitleOverrides({});
      });

    return () => {
      cancelled = true;
    };
  }, [data?.delulus]);

  const allEntries: DeluluLeaderboardEntry[] = useMemo(() => {
    if (!data?.delulus) return [];

    return data.delulus
      .map((d: any): DeluluLeaderboardEntry => {
        const cached = getCachedContent(d.contentHash);
        const onChainId = String(d.onChainId);
        const override = titleOverrides[onChainId]?.trim() || null;
        const manifestTitle = pickManifestTitle(cached);
        const resolved = hasContentResolved(d.contentHash);
        const title = override || manifestTitle;
        const titleLoading =
          !title &&
          ((!resolved && Boolean(d.contentHash)) || !metadataLoaded);

        const creatorStake = weiToNumber(d.creatorStake);
        const totalSupportCollected = weiToNumber(d.totalSupportCollected);
        const netShareG = ((d.shareTrades ?? []) as any[]).reduce((acc, t) => {
          const amt = weiToNumber(t.curveAmount ?? "0");
          return t.isBuy ? acc + amt : acc - amt;
        }, 0);
        const totalG = creatorStake + totalSupportCollected + Math.max(0, netShareG);
        return {
          id: d.id,
          onChainId,
          contentHash: d.contentHash,
          title,
          titleLoading,
          bgImageUrl: cached?.bgImageUrl ?? null,
          creatorAddress: d.creator?.id ?? "",
          creatorUsername: d.creator?.username ?? null,
          totalG,
          creatorStake,
          totalSupportCollected,
          points: Number(d.points ?? "0"),
          tradeCount: Number(d.tradeCount ?? "0"),
          uniqueBuyerCount: Number(d.uniqueBuyerCount ?? "0"),
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.totalG - a.totalG;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.delulus, ipfsResolved, titleOverrides, metadataLoaded]);

  const start = page * pageSize;
  const entries = allEntries.slice(start, start + pageSize);
  const hasNextPage = allEntries.length > start + pageSize;

  return {
    entries,
    allEntries,
    hasNextPage,
    isLoading: loading,
    error: error ?? null,
    refetch,
    campaignEndDate,
  };
}
