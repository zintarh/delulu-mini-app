"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { formatUnits } from "viem";
import { getCachedContent, batchResolveIPFS } from "@/lib/graph/ipfs-cache";

const GET_CHALLENGES = gql`
  query GetChallengesFeed($first: Int = 50, $skip: Int = 0) {
    challenges(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      challengeId
      contentHash
      poolAmount
      startTime
      duration
      totalPoints
      active
    }
  }
`;

// Helper to parse challenge content from IPFS
function parseChallengeContent(contentHash: string): { title: string; description: string } {
  const cachedContent = getCachedContent(contentHash);
  if (!cachedContent) {
    return { title: "", description: "" };
  }

  // Challenge content is stored as "title\n\ndescription"
  // It might be in the text field or content field
  const content = (cachedContent as any).text || (cachedContent as any).content || "";
  const parts = content.split("\n\n");
  return {
    title: parts[0] || "",
    description: parts.slice(1).join("\n\n") || "",
  };
}

export interface Challenge {
  id: number;
  contentHash: string;
  poolAmount: number;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalPoints: number;
  active: boolean;
  title?: string;
  description?: string;
}

export function useChallenges() {
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const { data, loading, error, refetch } = useQuery(GET_CHALLENGES, {
    variables: {
      first: 50,
      skip: 0,
    },
    // Avoid refetching on every mount/rerender (e.g. sidebar rerenders).
    // We can still refresh explicitly via `refetch()` if needed.
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  // Narrow the shape of the Apollo data to avoid `any` / `{}` type issues
  const challengesData = (data as { challenges?: any[] } | undefined)?.challenges;

  // Resolve IPFS content for challenges (only missing ones).
  useEffect(() => {
    if (!challengesData || challengesData.length === 0) {
      return;
    }

    const contentHashes = challengesData
      .map((c) => c.contentHash)
      .filter((h): h is string => !!h)
      .sort();

    if (contentHashes.length === 0) {
      return;
    }

    // Only fetch hashes that aren't already cached.
    const missing = contentHashes.filter((h) => !getCachedContent(h));
    if (missing.length === 0) return;

    batchResolveIPFS(missing).then(() => {
      setIpfsResolved((prev) => prev + 1);
    });
    // Depend on a stable key so rerenders don't retrigger.
  }, [challengesData ? challengesData.length : 0, challengesData?.[0]?.contentHash]);

  // Transform challenges with IPFS content
  const challenges = useMemo(() => {
    if (!challengesData) return [];

    return challengesData
      .map((c) => {
      const startTime = new Date(Number(c.startTime) * 1000);
      const endTime = new Date(startTime.getTime() + Number(c.duration) * 1000);
      const poolAmount = parseFloat(formatUnits(BigInt(c.poolAmount), 18));

      // Get IPFS content
      const { title, description } = parseChallengeContent(c.contentHash);

      return {
        id: Number(c.challengeId),
        contentHash: c.contentHash,
        poolAmount,
        startTime,
        endTime,
        duration: Number(c.duration),
        totalPoints: Number(c.totalPoints),
        active: Boolean(c.active),
        title,
        description,
      };
      })
      // Filter out test campaigns by title (case-insensitive)
      .filter(
        (challenge) =>
          !challenge.title || !challenge.title.toLowerCase().includes("test")
      );
  }, [challengesData, ipfsResolved]);

  return {
    challenges,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
