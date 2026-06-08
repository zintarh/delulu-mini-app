"use client";

import { useMemo, useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/hooks/use-auth";
import {
  transformSubgraphDelulu,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";
import {
  getMilestoneEndTimeMs,
  getMilestoneLabel,
  getDeluluCreatedAtMs,
} from "@/lib/milestone-utils";

export interface OngoingMilestone {
  /** Stable key for React */
  key: string;
  milestoneId: string;
  label: string;
  deadline: Date;
  endTimeMs: number;
  startTime: Date | null;
  isSubmitted: boolean;
  isVerified: boolean;
  isMissed: boolean;
  delulu: FormattedDelulu;
  /** Numeric delulu id used for the contract call */
  deluluNumericId: number;
}

export type MilestoneStepStatus =
  | "completed"
  | "due"
  | "review"
  | "upcoming"
  | "expired";

export interface MilestoneTrackerStep {
  index: number;
  key: string;
  milestoneId: string;
  label: string;
  status: MilestoneStepStatus;
  endTimeMs: number;
  /** Populated when status is `due` — used to open proof modal */
  due?: OngoingMilestone;
}

export interface DeluluMilestoneTracker {
  deluluKey: string;
  deluluNumericId: number;
  deluluHref: string;
  title: string;
  total: number;
  completed: number;
  underReview: number;
  /** Active milestones that still need proof */
  due: OngoingMilestone[];
  /** Full ordered timeline for profile UI */
  steps: MilestoneTrackerStep[];
}

export interface MilestoneTrackerSummary {
  totalMilestones: number;
  completedMilestones: number;
  dueNow: number;
  underReview: number;
  activeDeluluCount: number;
}

const GET_USER_ONGOING_DELULUS_WITH_MILESTONES = gql`
  query GetUserOngoingDelulusWithMilestones($creatorAddresses: [String!], $first: Int!) {
    delulus(
      where: { creatorAddress_in: $creatorAddresses, isResolved: false, isCancelled: false }
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      onChainId
      token
      creatorAddress
      contentHash
      stakingDeadline
      resolutionDeadline
      createdAt
      creatorStake
      totalSupportCollected
      totalSupporters
      challengeId
      points
      milestoneCount
      isResolved
      isCancelled
      rewardClaimed
      creator {
        id
      }
      milestones(first: 20, orderBy: milestoneId, orderDirection: asc, where: { isDeleted: false }) {
        id
        milestoneId
        milestoneURI
        deadline
        startTime
        isSubmitted
        isVerified
        isMissed
      }
    }
  }
`;

interface OngoingMilestoneRaw {
  id: string;
  milestoneId: string;
  milestoneURI?: string | null;
  deadline: string;
  startTime?: string | null;
  isSubmitted: boolean;
  isVerified: boolean;
  isMissed: boolean;
}

interface OngoingDeluluRaw extends SubgraphDeluluRaw {
  milestones?: OngoingMilestoneRaw[];
}

interface GetUserOngoingDelulusWithMilestonesData {
  delulus: OngoingDeluluRaw[];
}

interface GetUserOngoingDelulusWithMilestonesVars {
  creatorAddresses: string[];
  first: number;
}

export function useUserOngoingMilestones() {
  const { address } = useAuth();
  const creatorAddresses = useMemo(() => {
    if (!address) return [] as string[];
    return Array.from(new Set([address, address.toLowerCase()]));
  }, [address]);
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const { data, loading, networkStatus, error, refetch } = useQuery<
    GetUserOngoingDelulusWithMilestonesData,
    GetUserOngoingDelulusWithMilestonesVars
  >(
    GET_USER_ONGOING_DELULUS_WITH_MILESTONES,
    {
      variables: { creatorAddresses, first: 50 },
      skip: !address,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    },
  );

  // With cache-and-network, Apollo can briefly set loading=false before the
  // network response when cache is empty — keep skeleton until first settle.
  const hasSettled =
    networkStatus === 7 || networkStatus === 8 || !!error;

  useEffect(() => {
    if (!data?.delulus?.length) return;
    const hashes = data.delulus.map((d: any) => d.contentHash).filter(Boolean);
    batchResolveIPFS(hashes).then(() => setIpfsResolved((p) => p + 1));
  }, [data?.delulus]);

  const { milestones, trackers, summary } = useMemo(() => {
    if (!data?.delulus) {
      return {
        milestones: [] as OngoingMilestone[],
        trackers: [] as DeluluMilestoneTracker[],
        summary: {
          totalMilestones: 0,
          completedMilestones: 0,
          dueNow: 0,
          underReview: 0,
          activeDeluluCount: 0,
        } satisfies MilestoneTrackerSummary,
      };
    }

    const now = Date.now();
    const dueList: OngoingMilestone[] = [];
    const trackerList: DeluluMilestoneTracker[] = [];

    let totalMilestones = 0;
    let completedMilestones = 0;
    let underReview = 0;

    for (const raw of data.delulus) {
      const delulu = transformSubgraphDelulu(
        raw as SubgraphDeluluRaw,
        getCachedContent(raw.contentHash),
      );

      const resolutionMs = delulu.resolutionDeadline?.getTime?.() ?? 0;
      if (resolutionMs > 0 && resolutionMs <= now) continue;

      const rawMilestones: OngoingMilestoneRaw[] = raw.milestones ?? [];
      if (rawMilestones.length === 0) continue;

      const sorted = [...rawMilestones].sort(
        (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
      );

      const deluluCreatedAtMs = getDeluluCreatedAtMs(
        { createdAt: delulu.createdAt, stakingDeadline: delulu.stakingDeadline },
        now,
      );

      const title =
        delulu.content?.trim() ||
        `Delulu #${delulu.onChainId ?? delulu.id}`;
      const deluluHref = `/delulu/${delulu.onChainId ?? delulu.id}`;
      const dueForDelulu: OngoingMilestone[] = [];
      const steps: MilestoneTrackerStep[] = [];
      let completed = 0;
      let review = 0;
      let foundActiveDue = false;

      const activeMilestones = sorted.filter((m) => !m.isMissed);
      let prevEnd: number | null = null;
      let stepIndex = 0;

      for (const m of activeMilestones) {
        const deadline = timestampToDate(m.deadline);
        const startTime = m.startTime ? timestampToDate(m.startTime) : null;
        const endTimeMs = getMilestoneEndTimeMs(
          { startTime, deadline },
          prevEnd,
          deluluCreatedAtMs,
        );
        prevEnd = endTimeMs;
        stepIndex += 1;

        totalMilestones += 1;
        const label = getMilestoneLabel(
          { milestoneId: m.milestoneId, milestoneURI: m.milestoneURI },
          80,
        );
        const key = `${raw.id}-${m.milestoneId}`;

        if (m.isVerified) {
          completed += 1;
          completedMilestones += 1;
          steps.push({
            index: stepIndex,
            key,
            milestoneId: m.milestoneId,
            label,
            status: "completed",
            endTimeMs,
          });
          continue;
        }

        if (m.isSubmitted && !m.isVerified) {
          review += 1;
          underReview += 1;
          steps.push({
            index: stepIndex,
            key,
            milestoneId: m.milestoneId,
            label,
            status: "review",
            endTimeMs,
          });
          continue;
        }

        if (endTimeMs <= now) {
          steps.push({
            index: stepIndex,
            key,
            milestoneId: m.milestoneId,
            label,
            status: "expired",
            endTimeMs,
          });
          continue;
        }

        const item: OngoingMilestone = {
          key,
          milestoneId: m.milestoneId,
          label,
          deadline,
          endTimeMs,
          startTime,
          isSubmitted: m.isSubmitted,
          isVerified: m.isVerified,
          isMissed: m.isMissed,
          delulu,
          deluluNumericId: delulu.id,
        };

        const isCurrentDue = !foundActiveDue;
        if (isCurrentDue) {
          foundActiveDue = true;
          dueForDelulu.push(item);
          dueList.push(item);
          steps.push({
            index: stepIndex,
            key,
            milestoneId: m.milestoneId,
            label,
            status: "due",
            endTimeMs,
            due: item,
          });
        } else {
          steps.push({
            index: stepIndex,
            key,
            milestoneId: m.milestoneId,
            label,
            status: "upcoming",
            endTimeMs,
          });
        }
      }

      if (activeMilestones.length === 0) continue;

      trackerList.push({
        deluluKey: raw.id,
        deluluNumericId: delulu.id,
        deluluHref,
        title,
        total: activeMilestones.length,
        completed,
        underReview: review,
        due: dueForDelulu.sort((a, b) => a.endTimeMs - b.endTimeMs),
        steps,
      });
    }

    dueList.sort((a, b) => a.endTimeMs - b.endTimeMs);
    trackerList.sort((a, b) => {
      if (a.due.length > 0 && b.due.length === 0) return -1;
      if (a.due.length === 0 && b.due.length > 0) return 1;
      const aNext = a.due[0]?.endTimeMs ?? Infinity;
      const bNext = b.due[0]?.endTimeMs ?? Infinity;
      return aNext - bNext;
    });

    return {
      milestones: dueList,
      trackers: trackerList,
      summary: {
        totalMilestones,
        completedMilestones,
        dueNow: dueList.length,
        underReview,
        activeDeluluCount: trackerList.length,
      } satisfies MilestoneTrackerSummary,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.delulus, ipfsResolved]);

  return {
    milestones,
    trackers,
    summary,
    isLoading: !address || loading || (!hasSettled && !error),
    error: error ?? null,
    refetch,
  };
}
