"use client";

import { useMemo, useEffect, useState } from "react";
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

const ADMIN_DELULUS_LIMIT = 400;
const PENDING_MILESTONES_LIMIT = 200;

const GET_ADMIN_DELULUS = gql`
  query GetAdminDelulus($first: Int!) {
    delulus(
      first: $first
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
    }
  }
`;

const GET_PENDING_MILESTONES = gql`
  query GetPendingMilestones($first: Int!) {
    milestones(
      first: $first
      orderBy: id
      orderDirection: desc
      where: {
        isSubmitted: true
        isVerified: false
        isDeleted: false
      }
    ) {
      id
      milestoneId
      milestoneURI
      proofLink
      deadline
      submittedAt
      delulu {
        id
        onChainId
        contentHash
        creator {
          id
          username
        }
      }
    }
  }
`;

export type PendingMilestoneRow = {
  id: string;
  milestoneId: string;
  milestoneURI: string | null;
  proofLink: string | null;
  deadline: Date;
  submittedAt: Date | null;
  delulu: {
    id: string;
    onChainId: string;
    contentHash: string;
    creator: { id: string; username?: string | null };
  };
};

export function useAdminDelulus() {
  const [ipfsTick, setIpfsTick] = useState(0);
  const { data, loading, error, refetch } = useQuery<{
    delulus: SubgraphDeluluRaw[];
  }>(GET_ADMIN_DELULUS, {
    variables: { first: ADMIN_DELULUS_LIMIT },
    fetchPolicy: "cache-and-network",
  });

  const rows = data?.delulus ?? [];

  useEffect(() => {
    if (rows.length === 0) return;
    const hashes = rows.map((d) => d.contentHash);
    batchResolveIPFS(hashes).finally(() => setIpfsTick((t) => t + 1));
  }, [rows]);

  const delulus = useMemo<FormattedDelulu[]>(() => {
    if (rows.length === 0) return [];
    return rows
      .map((d) => {
        try {
          const cached = getCachedContent(d.contentHash);
          return transformSubgraphDelulu(d, cached);
        } catch {
          return null;
        }
      })
      .filter((d): d is FormattedDelulu => d !== null);
  }, [rows, ipfsTick]);

  return {
    delulus,
    isLoading: loading && rows.length === 0,
    error: error ?? null,
    refetch,
  };
}

export function usePendingMilestones() {
  const { data, loading, error, refetch } = useQuery<{
    milestones: Array<{
      id: string;
      milestoneId: string;
      milestoneURI?: string | null;
      proofLink?: string | null;
      deadline: string;
      submittedAt?: string | null;
      delulu: PendingMilestoneRow["delulu"];
    }>;
  }>(GET_PENDING_MILESTONES, {
    variables: { first: PENDING_MILESTONES_LIMIT },
    fetchPolicy: "cache-and-network",
  });

  const milestones = useMemo<PendingMilestoneRow[]>(() => {
    const raw = data?.milestones ?? [];
    return raw.map((m) => ({
      id: m.id,
      milestoneId: m.milestoneId,
      milestoneURI: m.milestoneURI ?? null,
      proofLink: m.proofLink ?? null,
      deadline: timestampToDate(m.deadline),
      submittedAt: m.submittedAt ? timestampToDate(m.submittedAt) : null,
      delulu: m.delulu,
    }));
  }, [data?.milestones]);

  return {
    milestones,
    isLoading: loading && !data?.milestones,
    error: error ?? null,
    refetch,
  };
}
