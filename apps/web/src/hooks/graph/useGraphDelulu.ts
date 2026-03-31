

 "use client";

import { useState, useEffect, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import {
  type GetDeluluByIdQuery,
  type GetDeluluByIdQueryVariables,
} from "@/generated/graphql";
import {
  transformSubgraphDelulu,
  weiToNumber,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { resolveIPFSContent, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

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
  milestoneURI: string | null;
  deadline: Date;
  startTime: Date | null;
  tippingWindowStart: Date | null;
  tippingWindowEnd: Date | null;
  proofLink: string | null;
  isSubmitted: boolean;
  isVerified: boolean;
  isMissed: boolean;
  totalSupport: number;
  pointsEarned: number;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
}

export const GET_DELULU_BY_ID = gql`
  query GetDeluluById($id: ID!) {
    delulu(id: $id) {
      id
      onChainId
      token
      creator {
        id
        totalStaked
        username
      }
      creatorAddress
      contentHash
      stakingDeadline
      resolutionDeadline
      createdAt
      creatorStake
      creatorIsStaked
      creatorStakeCurrent
      totalSupportCollected
      totalSupporters
      challengeId
      points
      milestoneCount
      isResolved
      isCancelled
      rewardClaimed
      isFailed
      finisherWindowEnd
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
      shareTrades(first: 100, orderBy: createdAt, orderDirection: asc) {
        id
        isBuy
        amount
        curveAmount
        createdAt
        user {
          id
        }
      }
      shareHoldings(first: 50) {
        id
        user {
          id
          username
        }
        balance
      }
      milestones(first: 50, orderBy: milestoneId, orderDirection: asc, where: { isDeleted: false }) {
        id
        milestoneId
        descriptionHash
        milestoneURI
        deadline
        startTime
        tippingWindowStart
        tippingWindowEnd
        isMissed
        proofLink
        isSubmitted
        isVerified
        pointsEarned
        totalSupport
        submittedAt
        verifiedAt
        rejectedAt
        rejectionReason
      }
    }
  }
`;

export function useGraphDelulu(deluluId: string | number | null) {
  const [ipfsResolved, setIpfsResolved] = useState(0);
  const id = deluluId !== null ? String(deluluId) : "";

  const { data, loading, error, refetch } = useQuery<
    GetDeluluByIdQuery,
    GetDeluluByIdQueryVariables
  >(GET_DELULU_BY_ID, {
    variables: { id },
    skip: !id,
    fetchPolicy: "cache-and-network",
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
    return data.delulu.milestones.map((m) => {
      const mm: any = m;
      return {
        id: mm.id,
        milestoneId: mm.milestoneId,
        descriptionHash: mm.descriptionHash,
        milestoneURI: mm.milestoneURI ?? null,
        deadline: timestampToDate(mm.deadline),
        startTime: mm.startTime ? timestampToDate(mm.startTime) : null,
        tippingWindowStart: mm.tippingWindowStart ? timestampToDate(mm.tippingWindowStart) : null,
        tippingWindowEnd: mm.tippingWindowEnd ? timestampToDate(mm.tippingWindowEnd) : null,
        // Normalize undefined to null so it matches GraphMilestone type
        proofLink: mm.proofLink ?? null,
        isSubmitted: mm.isSubmitted,
        isVerified: mm.isVerified,
        isMissed: mm.isMissed,
        totalSupport: weiToNumber(mm.totalSupport),
        pointsEarned: weiToNumber(mm.pointsEarned),
        submittedAt: mm.submittedAt ? timestampToDate(mm.submittedAt) : null,
        verifiedAt: mm.verifiedAt ? timestampToDate(mm.verifiedAt) : null,
        rejectedAt: mm.rejectedAt ? timestampToDate(mm.rejectedAt) : null,
        rejectionReason: mm.rejectionReason ?? null,
      };
    });
  }, [data?.delulu?.milestones]);

  const shareTrades = useMemo(() => {
    const raw = (data?.delulu as any)?.shareTrades;
    if (!raw) return [];
    return raw.map((t: any) => ({
      id: t.id,
      isBuy: t.isBuy as boolean,
      amount: Number(t.amount),
      curveAmount: weiToNumber(t.curveAmount),
      createdAt: timestampToDate(t.createdAt),
      userAddress: t.user?.id ?? "",
    }));
  }, [data?.delulu]);

  const shareHoldings = useMemo(() => {
    const raw = (data?.delulu as any)?.shareHoldings;
    if (!raw) return [];
    return raw
      .map((h: any) => ({
        userAddress: h.user?.id ?? "",
        username: h.user?.username ?? null,
        balance: Number(h.balance),
      }))
      .filter((h: any) => h.balance > 0);
  }, [data?.delulu]);

  return {
    delulu,
    stakes,
    milestones,
    shareTrades,
    shareHoldings,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
