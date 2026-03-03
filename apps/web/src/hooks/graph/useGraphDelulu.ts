

"use client";

import { useState, useEffect, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import type {
  GetDeluluByIdQuery,
  GetDeluluByIdQueryVariables,
} from "@/generated/graphql";
import {
  transformSubgraphDelulu,
  weiToNumber,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { resolveIPFSContent, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

// Local query definition kept in sync with the subgraph schema
const GET_DELULU_BY_ID = gql`
  query GetDeluluById($id: ID!) {
    delulu(id: $id) {
      id
      onChainId
      token
      creator {
        id
        totalStaked
      }
      creatorAddress
      contentHash
      stakingDeadline
      resolutionDeadline
      totalSupporters
      totalSupportCollected,
      createdAt
      creatorStake
      challengeId
      isResolved
      isCancelled
      stakes(first: 100, orderBy: createdAt, orderDirection: desc) {
        id
        user {
          id
        }
        amount
        txHash
        createdAt
      }
      claims(first: 100, orderBy: createdAt, orderDirection: desc) {
        id
        user {
          id
        }
        amount
        txHash
        createdAt
      }
      milestones(first: 50, orderBy: milestoneId, orderDirection: asc) {
        id
        milestoneId
        descriptionHash
        deadline
        proofLink
        isSubmitted
        isVerified
        pointsEarned
        submittedAt
        verifiedAt
        rejectedAt
        rejectionReason
      }
    }
  }
`;

export interface GraphStake {
  id: string;
  userAddress: string;
  amount: number;
  txHash: string;
  createdAt: Date;
}

export interface GraphMilestone {
  id: string;
  milestoneId: string;
  descriptionHash: string;
  deadline: Date;
  proofLink: string | null;
  isSubmitted: boolean;
  isVerified: boolean;
  pointsEarned: number;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
}

export function useGraphDelulu(deluluId: string | number | null) {
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const id = deluluId !== null ? String(deluluId) : "";

  const { data, loading, error, refetch } = useQuery<GetDeluluByIdQuery, GetDeluluByIdQueryVariables>(GET_DELULU_BY_ID, {
    variables: { id },
    skip: !id,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!data?.delulu?.contentHash) return;
    resolveIPFSContent(data.delulu.contentHash).then(() => {
      setIpfsResolved((prev) => prev + 1);
    });
  }, [data?.delulu?.contentHash]);



  const delulu: FormattedDelulu | null = useMemo(() => {
    if (!data?.delulu) return null;
    const raw = data.delulu as SubgraphDeluluRaw;
    return transformSubgraphDelulu(raw, getCachedContent(raw.contentHash));
  }, [data?.delulu, ipfsResolved]);

  const stakes: GraphStake[] = useMemo(() => {
    if (!data?.delulu?.stakes) return [];
    return data.delulu.stakes.map((s) => ({
      id: s.id,
      userAddress: s.user.id,
      amount: weiToNumber(s.amount),
      txHash: s.txHash,
      createdAt: timestampToDate(s.createdAt),
    }));
  }, [data?.delulu?.stakes]);

  const milestones: GraphMilestone[] = useMemo(() => {
    if (!data?.delulu?.milestones) return [];
    return data.delulu.milestones.map((m) => ({
      id: m.id,
      milestoneId: m.milestoneId,
      descriptionHash: m.descriptionHash,
      deadline: timestampToDate(m.deadline),
      // Normalize undefined to null so it matches GraphMilestone type
      proofLink: m.proofLink ?? null,
      isSubmitted: m.isSubmitted,
      isVerified: m.isVerified,
      pointsEarned: weiToNumber(m.pointsEarned),
      submittedAt: m.submittedAt ? timestampToDate(m.submittedAt) : null,
      verifiedAt: m.verifiedAt ? timestampToDate(m.verifiedAt) : null,
      rejectedAt: m.rejectedAt ? timestampToDate(m.rejectedAt) : null,
      rejectionReason: m.rejectionReason ?? null,
    }));
  }, [data?.delulu?.milestones]);

  return {
    delulu,
    stakes,
    milestones,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
