"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DeluluMetadata {
  on_chain_id: string;
  creator_address: string;
  title_override: string | null;
  description_override: string | null;
  image_override: string | null;
  is_hidden: boolean;
  goal_series_id: string | null;
  habit_id: string | null;
  updated_at: string;
}

export function useDeluluMetadata(onChainId: string | undefined | null) {
  return useQuery<DeluluMetadata | null>({
    queryKey: ["delulu-metadata", onChainId],
    queryFn: async () => {
      if (!onChainId) return null;
      const res = await fetch(`/api/goals/metadata/${onChainId}`);
      if (!res.ok) return null;
      const { metadata } = await res.json();
      return metadata ?? null;
    },
    enabled: !!onChainId,
    staleTime: 30_000,
  });
}

export function useEditDeluluMetadata(onChainId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      creatorAddress: string;
      titleOverride?: string;
      descriptionOverride?: string;
      imageOverride?: string;
    }) => {
      const res = await fetch(`/api/goals/metadata/${onChainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to update");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delulu-metadata", onChainId] });
    },
  });
}

export function useDeleteDeluluMetadata(onChainId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (creatorAddress: string) => {
      const res = await fetch(`/api/goals/metadata/${onChainId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorAddress }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to delete");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delulu-metadata", onChainId] });
    },
  });
}
