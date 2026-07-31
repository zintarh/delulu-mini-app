"use client";

import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import {
  GetForfeitActivityByUserDocument,
  type GetForfeitActivityByUserQuery,
  type GetForfeitActivityByUserQueryVariables,
} from "@/generated/graphql";
import { weiToTokenAmount, getTokenSymbol } from "@/lib/token-amounts";

export type ForfeitDestinationType = 0 | 1 | 2 | 3;

export interface GraphForfeitActivity {
  id: string;
  commitmentId: string;
  periodIndex: number;
  outcome: "success" | "forfeited";
  amount: number;
  tokenSymbol: string;
  destinationType: ForfeitDestinationType | null;
  destinationAddr: string | null;
  /** Success only, and only true for the period that actually returned the stake (the final one). */
  stakeReturned: boolean;
  txHash: string;
  createdAt: string;
}

export function useGraphUserForfeitActivity(address: string | undefined) {
  const creatorAddress = address?.toLowerCase() ?? "";

  const { data, loading, error } = useQuery<
    GetForfeitActivityByUserQuery,
    GetForfeitActivityByUserQueryVariables
  >(GetForfeitActivityByUserDocument, {
    variables: { address: creatorAddress },
    skip: !creatorAddress,
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
  });

  const activity: GraphForfeitActivity[] = useMemo(() => {
    if (!data?.forfeitPeriodResolutions) return [];
    return data.forfeitPeriodResolutions
      // A wallet activity feed is about money movement — drop interim "period
      // cleared, commitment still running" successes, which never move a stake.
      .filter((r) => r.outcome === "forfeited" || !r.commitment.active)
      .map((r) => {
        const token = r.commitment.token;
        const outcome = r.outcome === "forfeited" ? "forfeited" : "success";
        // The subgraph doesn't record per-resolution whether a success ended the
        // commitment (only `commitment.active`, which the contract flips to false
        // exactly once — on the final period's success). That's the only reliable
        // signal a stake was actually paid back; every other success is just a
        // cleared period with no money movement, so it gets no amount here.
        const stakeReturned = outcome === "success" && !r.commitment.active;
        const amount =
          outcome === "forfeited"
            ? weiToTokenAmount(r.amountToDestination, token)
            : stakeReturned
              ? weiToTokenAmount(r.commitment.stakeAmount, token)
              : 0;
        return {
          id: r.id,
          commitmentId: r.commitmentId,
          periodIndex: r.periodIndex,
          outcome,
          amount,
          tokenSymbol: getTokenSymbol(token),
          destinationType:
            r.destinationType != null ? (r.destinationType as ForfeitDestinationType) : null,
          destinationAddr: r.destinationAddr ?? null,
          stakeReturned,
          txHash: r.txHash,
          createdAt: new Date(Number(r.createdAt) * 1000).toISOString(),
        };
      });
  }, [data?.forfeitPeriodResolutions]);

  return {
    activity,
    isLoading: loading && !data,
    error: error ?? null,
  };
}
