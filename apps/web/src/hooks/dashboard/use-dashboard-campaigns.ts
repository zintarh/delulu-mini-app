"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exploreCampaignKeys } from "@/hooks/use-explore-campaigns";

export type DashboardCampaign = {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  proof_cadence: string;
  proof_instructions: string | null;
  content_hash: string | null;
  proposed_pool_amount: number;
  on_chain_challenge_id: number | null;
  status: string;
  display_ends_at: string | null;
  duration_days: number;
  prize_winner_count: number;
  cover_image_url: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  is_free_to_join?: boolean;
  join_token?: string | null;
  join_amount?: number | null;
  forfeit_pct?: number | null;
  community?: { id: string; name: string; slug: string } | null;
};

export const dashboardCampaignKeys = {
  all: ["dashboard", "campaigns"] as const,
  list: (filters?: { communityId?: string; status?: string }) =>
    [...dashboardCampaignKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...dashboardCampaignKeys.all, "detail", id] as const,
};

async function parseError(res: Response) {
  const json = await res.json().catch(() => ({}));
  throw new Error(json?.error ?? "Request failed");
}

export function useDashboardCampaigns(filters?: { communityId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.communityId) params.set("communityId", filters.communityId);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();

  return useQuery({
    queryKey: dashboardCampaignKeys.list(filters),
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/campaigns${qs ? `?${qs}` : ""}`);
      if (!res.ok) await parseError(res);
      const json = await res.json();
      return (json.campaigns ?? []) as DashboardCampaign[];
    },
    staleTime: 20_000,
  });
}

export function useDashboardCampaign(id: string) {
  return useQuery({
    queryKey: dashboardCampaignKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/campaigns/${id}`);
      if (!res.ok) await parseError(res);
      const json = await res.json();
      return {
        campaign: json.campaign as DashboardCampaign & {
          communities?: { id: string; name: string; slug: string };
        },
        leaderboard: json.leaderboard as Array<{
          wallet_address: string;
          points_total: number;
          current_streak: number;
        }>,
      };
    },
    enabled: Boolean(id),
  });
}

export function useCreateCampaign(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      proofCadence: "daily" | "weekly";
      proofInstructions?: string;
      proposedPoolAmount?: number;
      durationDays?: number;
      prizeWinnerCount?: number;
      coverImageUrl?: string | null;
      submit?: boolean;
      isFreeToJoin?: boolean;
      joinToken?: string;
      joinAmount?: number;
      forfeitPct?: number;
      telegramLink?: string;
      milestones?: { title: string; duration_days: number; order_index: number }[];
    }) => {
      const res = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId, ...input }),
      });
      if (!res.ok) await parseError(res);
      const json = await res.json();
      const campaign = json.campaign as DashboardCampaign;

      if (input.submit) {
        const submitRes = await fetch(`/api/dashboard/campaigns/${campaign.id}/submit`, {
          method: "POST",
        });
        if (!submitRes.ok) await parseError(submitRes);
        const submitJson = await submitRes.json();
        return { ...campaign, status: submitJson.campaign?.status ?? "pending_approval" };
      }

      return campaign;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardCampaignKeys.all });
    },
  });
}

export function useApproveCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dashboard/campaigns/${id}/approve`, { method: "POST" });
      if (!res.ok) await parseError(res);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardCampaignKeys.all });
    },
  });
}

export function useRejectCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/dashboard/campaigns/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) await parseError(res);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardCampaignKeys.all });
    },
  });
}

export function useConfirmCampaignFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      txHash,
      poolAmount,
    }: {
      id: string;
      txHash: string;
      poolAmount: number;
    }) => {
      const res = await fetch(`/api/dashboard/campaigns/${id}/confirm-fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, poolAmount }),
      });
      if (!res.ok) await parseError(res);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardCampaignKeys.all });
    },
  });
}

export function useUpdateCampaign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title?: string;
      proofCadence?: "daily" | "weekly";
      proofInstructions?: string;
      durationDays?: number;
      prizeWinnerCount?: number;
      coverImageUrl?: string | null;
    }) => {
      const res = await fetch(`/api/dashboard/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) await parseError(res);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardCampaignKeys.all });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dashboard/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) await parseError(res);
      return res.json();
    },
    onSuccess: (_data, deletedId) => {
      queryClient.setQueriesData<DashboardCampaign[]>(
        { queryKey: dashboardCampaignKeys.all },
        (campaigns) => {
          if (!Array.isArray(campaigns)) return campaigns;
          return campaigns.filter((c) => c.id !== deletedId);
        },
      );
      queryClient.removeQueries({ queryKey: dashboardCampaignKeys.detail(deletedId) });
      void queryClient.invalidateQueries({ queryKey: exploreCampaignKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["home", "campaigns"] });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("delulu:campaign-deleted", { detail: { id: deletedId } }),
        );
      }
    },
  });
}
