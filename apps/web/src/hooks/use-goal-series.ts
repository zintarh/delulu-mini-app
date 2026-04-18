"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface GoalSeriesHabit {
  id: string;
  goal_series_id: string;
  habit_id: string;
  title: string;
  description: string | null;
  priority: "high" | "medium" | "low";
  category: string;
  suggested_days: number;
  already_has: boolean;
  status: "pending" | "creating" | "active" | "completed" | "skipped";
  on_chain_id: string | null;
  sort_order: number;
  emoji: string | null;
}

export interface GoalSeries {
  id: string;
  creator_address: string;
  ultimate_goal: string;
  status: "active" | "completed" | "abandoned";
  created_at: string;
  goal_series_habits: GoalSeriesHabit[];
}

/** Fetch the active goal series for a wallet address. */
export function useGoalSeries(address: string | undefined | null) {
  return useQuery<GoalSeries | null>({
    queryKey: ["goal-series", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/goals/series?address=${encodeURIComponent(address)}`);
      if (!res.ok) return null;
      const { series } = await res.json();
      return series ?? null;
    },
    enabled: !!address,
    staleTime: 30_000,
  });
}

/** Skip the current habit in a series. */
export function useSkipHabit(seriesId: string | undefined, habitId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (creatorAddress: string) => {
      const res = await fetch(`/api/goals/series/${seriesId}/habits/${habitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorAddress, status: "skipped" }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Failed to skip habit");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goal-series"] });
    },
  });
}

/** Abandon a goal series. */
export function useAbandonSeries(seriesId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (creatorAddress: string) => {
      const res = await fetch(`/api/goals/series/${seriesId}/abandon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorAddress }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Failed to abandon series");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goal-series"] });
    },
  });
}
